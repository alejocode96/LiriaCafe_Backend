/**
 * ============================================================
 * Archivo: backend/src/config/logger.js
 * Propósito:
 * Sistema centralizado de logs usando Winston.
 *
 * Funciones principales:
 * - Mostrar logs legibles en consola
 * - Guardar logs persistentes en archivos
 * - Separar errores críticos
 * - Facilitar auditoría y debugging
 * - Mantener trazabilidad operativa del POS
 *
 * Entornos:
 * - Desarrollo:
 *   Consola coloreada + archivo simple
 *
 * - Producción:
 *   Consola + archivos con rotación por tamaño
 *
 * Niveles soportados:
 * error | warn | info | http | debug
 * ============================================================
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const env = require('./env');

/**
 * ============================================================
 * Crear carpeta de logs si no existe
 * ============================================================
 *
 * Evita errores al iniciar si la carpeta aún no fue creada.
 */

const logDir = path.resolve(env.logs.path);

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * ============================================================
 * Formato para consola
 * ============================================================
 *
 * Diseñado para lectura humana rápida durante desarrollo.
 *
 * Ejemplo:
 * [14:32:10] info: Servidor iniciado
 */

const consoleFormat = winston.format.combine(
  winston.format.colorize(),

  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),

  winston.format.printf(
    ({ level, message, timestamp, ...meta }) => {
      const extras = Object.keys(meta).length
        ? JSON.stringify(meta)
        : '';

      return `[${timestamp}] ${level}: ${message} ${extras}`;
    }
  )
);

/**
 * ============================================================
 * Formato para archivos
 * ============================================================
 *
 * JSON estructurado para:
 * - búsquedas
 * - auditoría
 * - análisis posterior
 * - integración con sistemas externos
 */

const fileFormat = winston.format.combine(
  winston.format.timestamp(),

  /**
   * Incluye stack trace automáticamente
   * cuando se registran errores reales.
   */
  winston.format.errors({
    stack: true,
  }),

  winston.format.json()
);

/**
 * ============================================================
 * Transportes activos
 * ============================================================
 *
 * Winston usa "transports" como destinos:
 * - consola
 * - archivo
 * - APIs externas
 * - bases de datos
 */

const transports = [
  /**
   * Siempre registrar en consola
   */
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

/**
 * ============================================================
 * Configuración por entorno
 * ============================================================
 */

if (!env.isDev) {
  /**
   * ------------------------------------------------------------
   * PRODUCCIÓN
   * ------------------------------------------------------------
   *
   * Archivos separados:
   * - error.log  -> solo errores
   * - app.log    -> eventos generales
   *
   * Rotación básica por tamaño:
   * evita crecimiento infinito.
   */

  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,

      /**
       * 10 MB máximo por archivo
       */
      maxsize: 10 * 1024 * 1024,

      /**
       * Mantener 5 archivos históricos
       */
      maxFiles: 5,
    }),

    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    })
  );
} else {
  /**
   * ------------------------------------------------------------
   * DESARROLLO
   * ------------------------------------------------------------
   *
   * Consola + archivo simple sin rotación compleja.
   */

  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      format: fileFormat,
    })
  );
}

/**
 * ============================================================
 * Instancia principal del logger
 * ============================================================
 */

const logger = winston.createLogger({
  /**
   * Nivel mínimo permitido
   * definido desde .env
   *
   * Ej:
   * error
   * warn
   * info
   * debug
   */
  level: env.logs.level,

  /**
   * Destinos configurados
   */
  transports,

  /**
   * Evita que el proceso muera
   * si Winston falla internamente.
   */
  exitOnError: false,
});

/**
 * ============================================================
 * Exportación
 * ============================================================
 *
 * Uso:
 *
 * const logger = require('./config/logger');
 *
 * logger.info('Servidor iniciado');
 * logger.error('Fallo DB');
 * logger.warn('Intento inválido');
 */

module.exports = logger;