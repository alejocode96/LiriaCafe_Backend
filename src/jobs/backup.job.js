// backend/src/jobs/backup.job.js
// ─────────────────────────────────────────────────────────────
// JOB: Backup automático de base de datos SQLite
// ─────────────────────────────────────────────────────────────
//
// Este job se encarga de generar copias de seguridad consistentes
// de la base de datos utilizando VACUUM INTO.
//
// Características:
// - Ejecución programada diaria (2:00 AM)
// - Backup inmediato al iniciar el sistema si no existen backups
// - Limpieza automática de backups antiguos
// - Uso de VACUUM INTO para generar una copia optimizada y consistente
//
// ─────────────────────────────────────────────────────────────

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');
const db = require('../config/db');
const logger = require('../config/logger');

const backupDir = path.resolve(env.backup.path);

/**
 * Asegura la existencia del directorio de backups.
 * Evita fallos en runtime si la carpeta no existe.
 */
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

/**
 * Ejecuta la creación de un backup manual o automático.
 *
 * Proceso:
 * 1. Genera timestamp único
 * 2. Construye nombre de archivo
 * 3. Ejecuta VACUUM INTO para copiar la base de datos
 * 4. Limpia backups antiguos según política de retención
 */
const runBackup = () => {
  try {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);

    const filename = `liriacafe-backup-${timestamp}.db`;
    const destPath = path.join(backupDir, filename);

    // Crea una copia optimizada y consistente de la base de datos
    db.exec(`VACUUM INTO '${destPath}'`);

    logger.info(`Backup creado: ${filename}`);

    // Limpieza de backups antiguos
    cleanOldBackups();

    return destPath;
  } catch (error) {
    logger.error('Error creando backup:', error);
  }
};

/**
 * Elimina backups antiguos según la política de retención.
 *
 * Regla:
 * - Mantiene los N backups más recientes
 * - Elimina el resto automáticamente
 */
const cleanOldBackups = () => {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('liriacafe-backup-') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtime,
      }))
      .sort((a, b) => b.mtime - a.mtime); // Más recientes primero

    const maxKeep = env.backup.keepDays;
    const toDelete = files.slice(maxKeep);

    for (const file of toDelete) {
      fs.unlinkSync(file.path);
      logger.info(`Backup antiguo eliminado: ${file.name}`);
    }
  } catch (error) {
    logger.error('Error limpiando backups:', error);
  }
};

/**
 * Inicia el job programado de backups.
 *
 * Configuración:
 * - Cron: 0 2 * * * (2:00 AM todos los días)
 * - Ejecuta backup automático
 * - Verifica existencia de backups al iniciar sistema
 */
const startBackupJob = () => {
  cron.schedule('0 2 * * *', () => {
    logger.info('Ejecutando backup automático...');
    runBackup();
  });

  logger.info('Job de backup programado: todos los días a las 2:00 AM');

  // Backup inicial si el sistema arranca sin históricos
  const existingBackups = fs
    .readdirSync(backupDir)
    .filter(f => f.endsWith('.db'));

  if (existingBackups.length === 0) {
    logger.info('No hay backups previos. Creando backup inicial...');
    runBackup();
  }
};

module.exports = { startBackupJob, runBackup };