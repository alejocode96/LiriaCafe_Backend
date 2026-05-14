/**
 * ============================================================
 * Archivo: backend/src/middlewares/error.middleware.js
 * Propósito:
 * Manejo centralizado de errores para toda la API.
 *
 * Funciones incluidas:
 * - errorMiddleware()     -> captura errores globales
 * - notFoundMiddleware()  -> rutas inexistentes
 *
 * Beneficios:
 * - Respuestas JSON consistentes
 * - Seguridad (oculta errores internos en producción)
 * - Logging centralizado
 * - Menos try/catch repetidos
 * - Mejor mantenimiento
 *
 * IMPORTANTE:
 * Debe registrarse al FINAL de app.js
 *
 * app.use(notFoundMiddleware);
 * app.use(errorMiddleware);
 *
 * Porque romper APIs con HTML de Express en vez de JSON
 * sigue siendo una tradición incomprensible.
 * ============================================================
 */

const logger = require('../config/logger');

/**
 * ============================================================
 * errorMiddleware(err, req, res, next)
 * ============================================================
 *
 * Middleware global de errores de Express.
 *
 * Captura cualquier error lanzado con:
 * - throw new Error(...)
 * - next(error)
 * - errores internos de middlewares
 * - errores JWT
 * - errores SQLite
 *
 * Firma obligatoria de Express:
 * (err, req, res, next)
 */

const errorMiddleware = (
  err,
  req,
  res,
  next
) => {
  /**
   * ==========================================================
   * Registrar error en logs
   * ==========================================================
   *
   * Incluye:
   * - mensaje
   * - stack trace
   * - ruta
   * - método HTTP
   * - usuario autenticado (si existe)
   */

  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    user: req.user?.id || 'anonymous',
  });

  /**
   * ==========================================================
   * Error de validación manual / express-validator
   * ==========================================================
   */

  if (err.type === 'validation') {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: err.errors,
    });
  }

  /**
   * ==========================================================
   * JWT expirado
   * ==========================================================
   */

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expirado',
    });
  }

  /**
   * ==========================================================
   * JWT inválido
   * ==========================================================
   */

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token inválido',
    });
  }

  /**
   * ==========================================================
   * UNIQUE constraint SQLite
   * ==========================================================
   *
   * Ejemplo:
   * username duplicado
   * barcode repetido
   */

  if (
    err.message?.includes(
      'UNIQUE constraint failed'
    )
  ) {
    const field = err.message
      .split('.')
      .pop();

    return res.status(409).json({
      success: false,
      message: `El valor para '${field}' ya existe`,
    });
  }

  /**
   * ==========================================================
   * FOREIGN KEY constraint
   * ==========================================================
   *
   * Ejemplo:
   * category_id inexistente
   */

  if (
    err.message?.includes(
      'FOREIGN KEY constraint failed'
    )
  ) {
    return res.status(400).json({
      success: false,
      message:
        'Referencia a registro inexistente',
    });
  }

  /**
   * ==========================================================
   * Error genérico
   * ==========================================================
   *
   * Si el error trae status personalizado:
   * err.status
   * err.statusCode
   *
   * Producción:
   * no exponer detalles internos
   *
   * Desarrollo:
   * mostrar mensaje real
   */

  const statusCode =
    err.statusCode ||
    err.status ||
    500;

  const message =
    process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message;

  return res.status(statusCode).json({
    success: false,
    message,
  });
};

/**
 * ============================================================
 * notFoundMiddleware(req, res)
 * ============================================================
 *
 * Middleware para rutas inexistentes.
 *
 * Debe ejecutarse antes del errorMiddleware.
 *
 * Ejemplo:
 * GET /api/loquesea
 */

const notFoundMiddleware = (
  req,
  res
) => {
  return res.status(404).json({
    success: false,
    message:
      `Ruta no encontrada: ${req.method} ${req.path}`,
  });
};

/**
 * ============================================================
 * Exportación pública
 * ============================================================
 */

module.exports = {
  errorMiddleware,
  notFoundMiddleware,
};