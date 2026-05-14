// backend/src/middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const { unauthorized } = require('../utils/response');

const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return unauthorized(res, 'Token de acceso requerido');
  }

  // Verificar si el token fue revocado (logout real)
  const { isTokenRevoked } = require('../modules/auth/service');
  if (isTokenRevoked(token)) {
    return unauthorized(res, 'Token revocado. Inicia sesión nuevamente.');
  }

  try {
    const decoded = jwt.verify(token, env.jwt.secret);

    const user = db.prepare(`
      SELECT u.id, u.name, u.username, u.role_id, u.is_active,
             r.name as role_name, r.permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.is_active = 1 AND u.deleted_at IS NULL
    `).get(decoded.id);

    if (!user) {
      return unauthorized(res, 'Usuario no encontrado o inactivo');
    }

    user.permissions = JSON.parse(user.permissions || '{}');
    req.user = user;
    req.token = token; // Guardar token en request para el logout
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return unauthorized(res, 'Token expirado, inicia sesión nuevamente');
    }
    return unauthorized(res, 'Token inválido');
  }
};

module.exports = { authenticate };