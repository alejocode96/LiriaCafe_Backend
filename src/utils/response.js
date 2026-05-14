/**
 * ============================================================
 * Archivo: backend/src/utils/response.js
 * Propósito:
 * Centralizar respuestas HTTP del backend para mantener
 * consistencia en toda la API.
 *
 * Beneficios:
 * - Misma estructura en todos los endpoints
 * - Frontend más fácil de consumir
 * - Menos código repetido
 * - Mejor mantenimiento
 * - Errores predecibles
 *
 * Formato estándar:
 *
 * Éxito:
 * {
 *   success: true,
 *   message: "OK",
 *   data: {}
 * }
 *
 * Error:
 * {
 *   success: false,
 *   message: "No autorizado"
 * }
 *
 * Lista:
 * {
 *   success: true,
 *   data: [],
 *   meta: {
 *     page: 1,
 *     total: 25
 *   }
 * }
 *
 * Porque aparentemente a la humanidad le cuesta
 * responder APIs de forma ordenada.
 * ============================================================
 */

/**
 * ============================================================
 * 200 OK
 * ============================================================
 *
 * Respuesta estándar exitosa.
 *
 * Uso:
 * return ok(res, user, 'Usuario encontrado');
 */

const ok = (
  res,
  data = null,
  message = 'OK'
) => {
  return res.status(200).json({
    success: true,
    message,
    data,
  });
};

/**
 * ============================================================
 * 201 Created
 * ============================================================
 *
 * Recurso creado exitosamente.
 *
 * Uso:
 * return created(res, product, 'Producto creado');
 */

const created = (
  res,
  data = null,
  message = 'Creado exitosamente'
) => {
  return res.status(201).json({
    success: true,
    message,
    data,
  });
};

/**
 * ============================================================
 * 200 List / Collection
 * ============================================================
 *
 * Para listados y paginación.
 *
 * meta puede incluir:
 * - page
 * - perPage
 * - total
 * - totalPages
 */

const list = (
  res,
  data = [],
  meta = {}
) => {
  return res.status(200).json({
    success: true,
    data,
    meta,
  });
};

/**
 * ============================================================
 * 400 Bad Request
 * ============================================================
 *
 * Datos inválidos enviados por cliente.
 *
 * errors puede incluir detalles de validación.
 */

const badRequest = (
  res,
  message = 'Datos inválidos',
  errors = null
) => {
  return res.status(400).json({
    success: false,
    message,
    errors,
  });
};

/**
 * ============================================================
 * 401 Unauthorized
 * ============================================================
 *
 * No autenticado o token inválido.
 */

const unauthorized = (
  res,
  message = 'No autorizado'
) => {
  return res.status(401).json({
    success: false,
    message,
  });
};

/**
 * ============================================================
 * 403 Forbidden
 * ============================================================
 *
 * Usuario autenticado pero sin permisos.
 */

const forbidden = (
  res,
  message = 'Acceso denegado'
) => {
  return res.status(403).json({
    success: false,
    message,
  });
};

/**
 * ============================================================
 * 404 Not Found
 * ============================================================
 *
 * Recurso no existe.
 */

const notFound = (
  res,
  message = 'No encontrado'
) => {
  return res.status(404).json({
    success: false,
    message,
  });
};

/**
 * ============================================================
 * 409 Conflict
 * ============================================================
 *
 * Conflicto lógico:
 * - usuario duplicado
 * - código repetido
 * - email existente
 */

const conflict = (
  res,
  message = 'Recurso duplicado'
) => {
  return res.status(409).json({
    success: false,
    message,
  });
};

/**
 * ============================================================
 * 500 Internal Server Error
 * ============================================================
 *
 * Error inesperado del backend.
 */

const serverError = (
  res,
  message = 'Error interno del servidor'
) => {
  return res.status(500).json({
    success: false,
    message,
  });
};

/**
 * ============================================================
 * Exportación pública
 * ============================================================
 */

module.exports = {
  ok,
  created,
  list,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError,
};