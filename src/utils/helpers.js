/**
 * ============================================================
 * Archivo: backend/src/utils/helpers.js
 * Propósito:
 * Funciones utilitarias reutilizables de uso general dentro
 * del backend LIRIACAFE POS.
 *
 * Beneficios:
 * - Evita duplicación de lógica
 * - Código más limpio
 * - Utilidades centralizadas
 * - Mantenimiento sencillo
 * - Reutilización entre módulos
 *
 * Contiene helpers para:
 * - Paginación
 * - Formato monetario
 * - IP del cliente
 * - Limpieza de updates parciales
 * - Fechas actuales
 *
 * Porque repetir funciones en 19 archivos distintos
 * es una costumbre humana bastante pintoresca.
 * ============================================================
 */

/**
 * ============================================================
 * buildPagination(query)
 * ============================================================
 *
 * Construye parámetros de paginación seguros para SQLite.
 *
 * Entrada esperada:
 * req.query
 *
 * Parámetros soportados:
 * - page   = página actual
 * - limit  = registros por página
 *
 * Reglas:
 * - page mínimo = 1
 * - limit mínimo = 1
 * - limit máximo = 100
 * - default page = 1
 * - default limit = 20
 *
 * Retorna:
 * {
 *   limit,
 *   offset,
 *   page,
 *   pageSize
 * }
 *
 * Uso:
 * const { limit, offset } = buildPagination(req.query);
 *
 * SQL:
 * SELECT * FROM products LIMIT ? OFFSET ?
 */

const buildPagination = (query) => {
  const page = Math.max(
    1,
    parseInt(query.page) || 1
  );

  const pageSize = Math.min(
    100,
    Math.max(
      1,
      parseInt(query.limit) || 20
    )
  );

  const offset = (page - 1) * pageSize;

  return {
    limit: pageSize,
    offset,
    page,
    pageSize,
  };
};

/**
 * ============================================================
 * formatCurrency(amount)
 * ============================================================
 *
 * Convierte número a formato monetario colombiano.
 *
 * Ejemplo:
 * 12500 -> $12.500
 *
 * Uso:
 * formatCurrency(25000)
 */

const formatCurrency = (amount) => {
  return new Intl.NumberFormat(
    'es-CO',
    {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }
  ).format(amount || 0);
};

/**
 * ============================================================
 * getClientIp(req)
 * ============================================================
 *
 * Obtiene IP real del cliente.
 *
 * Compatible con:
 * - Proxy reverso
 * - Nginx
 * - Cloudflare
 * - Render / Railway / VPS
 * - Express local
 *
 * Prioridad:
 * 1. x-forwarded-for
 * 2. x-real-ip
 * 3. remoteAddress
 * 4. req.ip
 * 5. unknown
 *
 * Uso:
 * const ip = getClientIp(req);
 */

const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']
      ?.split(',')[0]
      ?.trim() ||

    req.headers['x-real-ip'] ||

    req.connection?.remoteAddress ||

    req.ip ||

    'unknown'
  );
};

/**
 * ============================================================
 * sanitizeUpdate(obj, allowedFields)
 * ============================================================
 *
 * Limpia objeto para updates parciales.
 *
 * Solo conserva:
 * - campos permitidos
 * - valores distintos de null / undefined
 *
 * Ideal para PATCH / PUT.
 *
 * Ejemplo:
 *
 * Entrada:
 * {
 *   name: "Cafe",
 *   stock: null,
 *   fake: "hack"
 * }
 *
 * allowedFields:
 * ['name', 'stock']
 *
 * Salida:
 * {
 *   name: "Cafe"
 * }
 */

const sanitizeUpdate = (
  obj,
  allowedFields
) => {
  return allowedFields.reduce(
    (acc, field) => {
      if (
        obj[field] !== undefined &&
        obj[field] !== null
      ) {
        acc[field] = obj[field];
      }

      return acc;
    },
    {}
  );
};

/**
 * ============================================================
 * now()
 * ============================================================
 *
 * Retorna fecha/hora actual en formato ISO.
 *
 * Útil para:
 * - updated_at
 * - logs manuales
 * - timestamps personalizados
 *
 * Ejemplo:
 * 2026-05-13T23:55:10.000Z
 */

const now = () => {
  return new Date().toISOString();
};

/**
 * ============================================================
 * Exportación pública
 * ============================================================
 */

module.exports = {
  buildPagination,
  formatCurrency,
  getClientIp,
  sanitizeUpdate,
  now,
};