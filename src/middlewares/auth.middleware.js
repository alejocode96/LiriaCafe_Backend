/**
 * ============================================================
 * Archivo: backend/src/middlewares/auth.middleware.js
 * Propósito:
 * Proteger rutas privadas mediante autenticación JWT.
 *
 * Función principal:
 * - authenticate()
 *
 * Responsabilidades:
 * - Leer token Bearer del header Authorization
 * - Validar firma y expiración del JWT
 * - Consultar usuario en base de datos
 * - Verificar que siga activo
 * - Cargar permisos y rol
 * - Inyectar req.user
 *
 * Uso:
 * router.get('/profile', authenticate, controller);
 *
 * Resultado:
 * req.user disponible en rutas protegidas.
 *
 * Porque confiar ciegamente en cualquier request anónimo
 * es una filosofía bastante temeraria.
 * ============================================================
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');

const {
  unauthorized,
} = require('../utils/response');

/**
 * ============================================================
 * authenticate(req, res, next)
 * ============================================================
 *
 * Middleware de autenticación.
 *
 * Espera header:
 *
 * Authorization: Bearer TOKEN_AQUI
 *
 * Si todo sale bien:
 * req.user = usuario autenticado
 * next()
 */

const authenticate = (
  req,
  res,
  next
) => {
  /**
   * ==========================================================
   * Extraer token del header Authorization
   * ==========================================================
   */

  const authHeader =
    req.headers['authorization'];

  const token =
    authHeader &&
    authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

  /**
   * ==========================================================
   * Token ausente
   * ==========================================================
   */

  if (!token) {
    return unauthorized(
      res,
      'Token de acceso requerido'
    );
  }

  try {
    /**
     * ========================================================
     * Validar JWT
     * ========================================================
     *
     * Verifica:
     * - firma
     * - expiración
     * - integridad
     */

    const decoded = jwt.verify(
      token,
      env.jwt.secret
    );

    /**
     * ========================================================
     * Consultar usuario actual en DB
     * ========================================================
     *
     * No basta confiar en el token:
     * el usuario pudo ser:
     * - desactivado
     * - eliminado
     * - cambiado de rol
     */

    const user = db.prepare(`
      SELECT
        u.id,
        u.name,
        u.username,
        u.role_id,
        u.is_active,
        r.name AS role_name,
        r.permissions
      FROM users u
      JOIN roles r
        ON u.role_id = r.id
      WHERE u.id = ?
        AND u.is_active = 1
        AND u.deleted_at IS NULL
    `).get(decoded.id);

    /**
     * ========================================================
     * Usuario inválido
     * ========================================================
     */

    if (!user) {
      return unauthorized(
        res,
        'Usuario no encontrado o inactivo'
      );
    }

    /**
     * ========================================================
     * Convertir permisos JSON a objeto
     * ========================================================
     */

    user.permissions = JSON.parse(
      user.permissions || '{}'
    );

    /**
     * ========================================================
     * Inyectar usuario autenticado
     * ========================================================
     */

    req.user = user;

    /**
     * Continuar request
     */

    next();

  } catch (error) {
    /**
     * ========================================================
     * Token expirado
     * ========================================================
     */

    if (
      error.name ===
      'TokenExpiredError'
    ) {
      return unauthorized(
        res,
        'Token expirado, inicia sesión nuevamente'
      );
    }

    /**
     * ========================================================
     * Token inválido
     * ========================================================
     */

    return unauthorized(
      res,
      'Token inválido'
    );
  }
};

/**
 * ============================================================
 * Exportación pública
 * ============================================================
 */

module.exports = {
  authenticate,
};