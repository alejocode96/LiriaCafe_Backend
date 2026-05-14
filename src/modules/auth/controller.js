// backend/src/modules/auth/controller.js
// ─── Controlador HTTP para autenticación ─────────────────────────────

const service = require('./service');
const { ok, unauthorized, serverError } = require('../../utils/response');
const { logAudit } = require('../audit/service');
const { getClientIp } = require('../../utils/helpers');

/**
 * @module AuthController
 * @description Controlador encargado de manejar autenticación de usuarios:
 * login, logout, obtención de perfil y refresh de tokens.
 */

/**
 * @function login
 * @description Autentica un usuario con username y password.
 * Genera tokens (según el service) y registra evento de auditoría.
 *
 * @route POST /auth/login
 * @access Public
 *
 * @param {import('express').Request} req - Request de Express
 * @param {import('express').Response} res - Response de Express
 * @param {import('express').NextFunction} next - Middleware de error
 *
 * @returns {Object} 200 - Usuario autenticado + tokens
 * @returns {Object} 401 - Credenciales inválidas
 * @returns {Object} 500 - Error interno
 */
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const result = await service.login(username, password);

    // Auditoría de login exitoso
    await logAudit({
      userId: result.user.id,
      action: 'LOGIN',
      module: 'auth',
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    return ok(res, result, 'Login exitoso');
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * @function logout
 * @description Registra cierre de sesión del usuario.
 * JWT es stateless, por lo tanto el token se invalida en cliente
 * o mediante blacklist si se implementa.
 *
 * @route POST /auth/logout
 * @access Private
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 *
 * @returns {Object} 200 - Confirmación de logout
 */
const logout = async (req, res, next) => {
  try {
    // Revocar el token actual — logout real
    const { logout: logoutService } = require('./service');
    logoutService(req.token);

    await logAudit({
      userId: req.user.id,
      action: 'LOGOUT',
      module: 'auth',
      ip: getClientIp(req),
    });

    return ok(res, null, 'Sesión cerrada correctamente');
  } catch (error) {
    next(error);
  }
};

/**
 * @function me
 * @description Retorna la información del usuario autenticado.
 * Elimina campos sensibles como password_hash antes de responder.
 *
 * @route GET /auth/me
 * @access Private
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 *
 * @returns {Object} 200 - Datos del usuario autenticado
 */
const me = (req, res) => {
  const { password_hash, ...user } = req.user;
  return ok(res, user, 'Perfil de usuario');
};

/**
 * @function refresh
 * @description Genera nuevos tokens a partir de un refresh token válido.
 *
 * @route POST /auth/refresh
 * @access Public (pero requiere refreshToken válido)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 *
 * @returns {Object} 200 - Nuevos tokens de acceso
 * @returns {Object} 401 - Refresh token inválido o ausente
 */
const refresh = (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return unauthorized(res, 'Refresh token requerido');
    }

    const result = service.refreshToken(refreshToken);
    return ok(res, result, 'Token renovado');
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

module.exports = {
  login,
  logout,
  me,
  refresh,
};