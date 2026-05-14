/**
 * ============================================================
 * Archivo: backend/src/config/db.js
 * Propósito:
 * Configuración y conexión centralizada a SQLite mediante
 * better-sqlite3.
 *
 * Tipo de conexión:
 * - Singleton global
 * - Una sola instancia compartida por todo el backend
 *
 * Beneficios:
 * - Simplicidad operacional
 * - Alto rendimiento en SQLite local
 * - Código limpio sin callbacks innecesarios
 * - Inicialización única del motor
 *
 * Razón para usar better-sqlite3:
 * - API síncrona clara y mantenible
 * - Excelente rendimiento local
 * - Ideal para POS locales / negocios pequeños-medianos
 * - Menor complejidad que drivers async tradicionales
 * ============================================================
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const env = require('./env');
const logger = require('./logger');

/**
 * ============================================================
 * Resolver ruta absoluta de la base de datos
 * ============================================================
 *
 * Convierte rutas relativas del .env en rutas completas.
 *
 * Ejemplo:
 * ./src/database/liriacafe.db
 *
 * Resultado:
 * C:\proyecto\backend\src\database\liriacafe.db
 */

const dbPath = path.resolve(env.db.path);

/**
 * Obtiene carpeta contenedora del archivo .db
 */
const dbDir = path.dirname(dbPath);

/**
 * ============================================================
 * Crear directorio si no existe
 * ============================================================
 *
 * Evita fallos al iniciar en instalaciones nuevas.
 */

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

/**
 * ============================================================
 * Variable singleton de conexión
 * ============================================================
 */

let db;

/**
 * ============================================================
 * Inicialización segura de SQLite
 * ============================================================
 *
 * Si algo falla:
 * - se registra error
 * - se detiene el sistema
 *
 * Esto evita arrancar backend sin base de datos válida.
 */

try {
  db = new Database(dbPath, {
    /**
     * Verbose:
     * En desarrollo imprime cada SQL ejecutado.
     *
     * Muy útil para debugging.
     */
    verbose: env.isDev
      ? (sql) => logger.debug(`SQL: ${sql}`)
      : null,
  });

  /**
   * ==========================================================
   * PRAGMAS SQLite
   * ==========================================================
   *
   * Ajustes internos del motor para rendimiento,
   * seguridad y concurrencia.
   */

  /**
   * WAL = Write Ahead Log
   *
   * Mejora concurrencia lectura/escritura.
   * Ideal para sistemas POS con múltiples operaciones.
   */
  db.pragma('journal_mode = WAL');

  /**
   * Activar llaves foráneas.
   *
   * SQLite viene apagado por defecto.
   * Necesario para integridad relacional.
   */
  db.pragma('foreign_keys = ON');

  /**
   * Balance entre rendimiento y seguridad.
   *
   * NORMAL reduce escrituras de disco extremas
   * manteniendo buena confiabilidad.
   */
  db.pragma('synchronous = NORMAL');

  /**
   * Cache en memoria.
   *
   * Valor negativo = KB
   * -64000 = 64 MB
   */
  db.pragma('cache_size = -64000');

  /**
   * Tablas temporales en RAM.
   *
   * Mejora velocidad de operaciones temporales.
   */
  db.pragma('temp_store = MEMORY');

  /**
   * Confirmación de conexión exitosa.
   */
  logger.info(`Base de datos conectada: ${dbPath}`);

} catch (error) {
  /**
   * Error crítico de arranque.
   *
   * Si no hay DB funcional, no tiene sentido
   * levantar el backend.
   */
  logger.error('Error conectando a la base de datos', {
    message: error.message,
    stack: error.stack,
  });

  process.exit(1);
}

/**
 * ============================================================
 * Exportación singleton
 * ============================================================
 *
 * Uso:
 *
 * const db = require('./config/db');
 *
 * const users = db.prepare(
 *   'SELECT * FROM users'
 * ).all();
 */

module.exports = db;