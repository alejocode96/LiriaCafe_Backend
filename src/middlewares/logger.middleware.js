/**
 * ============================================================
 * Archivo: backend/src/middlewares/logger.middleware.js
 * Propósito:
 * Registrar automáticamente cada request HTTP recibido por
 * la API junto con su resultado y tiempo de respuesta.
 *
 * Beneficios:
 * - Auditoría básica de tráfico
 * - Diagnóstico de errores
 * - Medición de rendimiento
 * - Seguimiento de usuarios
 * - Historial operacional
 *
 * Qué registra:
 * - método HTTP
 * - ruta
 * - código de estado
 * - duración
 * - usuario autenticado
 * - IP cliente
 *
 * Uso:
 * app.use(loggerMiddleware);
 *
 * Porque revisar bugs sin logs es una actividad
 * favorita de quienes disfrutan sufrir gratis.
 * ============================================================
 */

const logger = require('../config/logger');

/**
 * ============================================================
 * loggerMiddleware(req, res, next)
 * ============================================================
 *
 * Middleware Express que mide el tiempo desde que entra
 * la solicitud hasta que se envía la respuesta final.
 *
 * Usa:
 * res.on('finish')
 *
 * finish se dispara cuando la respuesta terminó.
 */

const loggerMiddleware = (
  req,
  res,
  next
) => {
  /**
   * Tiempo inicial en milisegundos
   */

  const start = Date.now();

  /**
   * ==========================================================
   * Evento finish
   * ==========================================================
   *
   * Se ejecuta al finalizar la respuesta HTTP.
   */

  res.on('finish', () => {
    /**
     * Duración total del request
     */

    const duration =
      Date.now() - start;

    /**
     * ========================================================
     * Nivel de log automático
     * ========================================================
     *
     * 500+ = error
     * 400+ = warn
     * resto = http
     */

    const level =
      res.statusCode >= 500
        ? 'error'
        : res.statusCode >= 400
        ? 'warn'
        : 'http';

    /**
     * ========================================================
     * Registro estructurado
     * ========================================================
     */

    logger[level]({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      user:
        req.user?.username ||
        'anon',
      ip: req.ip,
    });
  });

  /**
   * Continuar pipeline Express
   */

  next();
};

/**
 * ============================================================
 * Exportación pública
 * ============================================================
 */

module.exports = loggerMiddleware;