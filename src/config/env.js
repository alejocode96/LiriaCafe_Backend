/**
 * ============================================================
 * Archivo: backend/src/config/env.js
 * Propósito:
 * Centraliza la carga, validación y normalización de variables
 * de entorno para todo el backend de LIRIACAFE POS.
 *
 * Beneficios:
 * - Configuración en un solo lugar
 * - Fail-fast si faltan variables críticas
 * - Valores por defecto seguros
 * - Código más limpio en el resto del sistema
 * - Fácil mantenimiento entre desarrollo/producción
 * ============================================================
 */

require('dotenv').config();
/**
 * Carga automáticamente variables desde archivo .env y las inserta en process.env
 *
 * Ejemplo:
 * PORT=3001
 * JWT_SECRET=xxxx
 */

/**
 * Variables obligatorias para arrancar la aplicación.
 * Si faltan, el sistema se detiene inmediatamente.
 */
const required = ['JWT_SECRET', 'DB_PATH'];

/**
 * Validación fail-fast:
 * Recorre cada variable requerida y detiene ejecución
 * si alguna no existe.
 */
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[ENV ERROR] Variable requerida faltante: ${key}`);
    process.exit(1);
  }
}

/**
 * Exporta objeto de configuración listo para usar
 * en cualquier parte del proyecto.
 *
 * Ejemplo:
 * const env = require('./config/env');
 * app.listen(env.port);
 */
module.exports = {
  /**
   * ------------------------------------------------
   * Configuración general del servidor
   * ------------------------------------------------
   */
  port: parseInt(process.env.PORT, 10) || 3001,

  nodeEnv: process.env.NODE_ENV || 'development',

  /**
   * True si NO está en producción
   * Útil para logs, debugging y comportamientos condicionales
   */
  isDev: process.env.NODE_ENV !== 'production',

  /**
   * ------------------------------------------------
   * Base de datos SQLite
   * ------------------------------------------------
   */
  db: {
    /**
     * Ruta física del archivo .db
     */
    path: process.env.DB_PATH || './src/database/liriacafe.db',
  },

  /**
   * ------------------------------------------------
   * JWT / Autenticación
   * ------------------------------------------------
   */
  jwt: {
    /**
     * Clave secreta para firmar tokens
     * IMPORTANTE: cambiar en producción
     */
    secret: process.env.JWT_SECRET,

    /**
     * Tiempo de vida token acceso
     * Ej: 8h
     */
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',

    /**
     * Tiempo de vida refresh token
     * Ej: 7d
     */
    refreshExpiresIn:
      process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  /**
   * ------------------------------------------------
   * CORS
   * ------------------------------------------------
   */
  cors: {
    /**
     * Convierte:
     * http://localhost:3000,http://localhost:5173
     *
     * En:
     * ['http://localhost:3000', 'http://localhost:5173']
     */
    origins: (
      process.env.CORS_ORIGINS ||
      'http://localhost:3000'
    ).split(','),
  },

  /**
   * ------------------------------------------------
   * Rate Limiting / Anti abuso
   * ------------------------------------------------
   */
  rateLimit: {
    /**
     * Ventana de tiempo en ms
     * 900000 = 15 minutos
     */
    windowMs:
      parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) ||
      900000,

    /**
     * Máximo requests generales
     */
    max:
      parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,

    /**
     * Máximo intentos login
     */
    loginMax:
      parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 10,
  },

  /**
   * ------------------------------------------------
   * Backups automáticos
   * ------------------------------------------------
   */
  backup: {
    /**
     * Días que se conservan respaldos
     */
    keepDays:
      parseInt(process.env.BACKUP_KEEP_DAYS, 10) || 15,

    /**
     * Carpeta backups
     */
    path:
      process.env.BACKUP_PATH ||
      './storage/backups',
  },

  /**
   * ------------------------------------------------
   * Logs del sistema
   * ------------------------------------------------
   */
  logs: {
    /**
     * Carpeta logs
     */
    path:
      process.env.LOG_PATH ||
      './storage/logs',

    /**
     * Nivel:
     * error | warn | info | debug
     */
    level:
      process.env.LOG_LEVEL || 'info',
  },

  /**
   * ------------------------------------------------
   * Subida de imágenes / Multer
   * ------------------------------------------------
   */
  upload: {
    /**
     * Ruta almacenamiento imágenes productos
     */
    path:
      process.env.UPLOAD_PATH ||
      './storage/images',

    /**
     * Tamaño máximo bytes
     * 5242880 = 5MB
     */
    maxSize:
      parseInt(process.env.MAX_FILE_SIZE, 10) ||
      5242880,
  },
};