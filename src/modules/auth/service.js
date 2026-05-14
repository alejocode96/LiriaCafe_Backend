// backend/src/modules/auth/service.js
// ─────────────────────────────────────────────────────────────
// CAPA SERVICE - Módulo de Autenticación
// -------------------------------------------------------------
// Responsabilidad:
// Contener toda la lógica de negocio relacionada con:
//
// - Inicio de sesión
// - Validación de credenciales
// - Bloqueo por intentos fallidos
// - Generación de JWT access token
// - Generación de refresh token
// - Renovación de sesión
//
// Esta capa NO responde HTTP.
// Esta capa NO contiene rutas.
// Solo procesa reglas del negocio.
//
// Flujo esperado:
// Controller -> Service -> Repository
// ─────────────────────────────────────────────────────────────

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const env = require('../../config/env');
const repo = require('./repository');
const logger = require('../../config/logger');
const db = require('../../config/db');

/**
 * Configuración de seguridad.
 *
 * MAX_ATTEMPTS:
 * Cantidad máxima de intentos fallidos antes de bloquear.
 *
 * LOCK_MINUTES:
 * Tiempo de bloqueo temporal.
 */
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 30;

/**
 * Genera Access Token JWT.
 *
 * Uso:
 * Token principal enviado en Authorization Bearer.
 *
 * Contiene:
 * - id usuario
 * - username
 * - rol
 *
 * @param {Object} user
 * @returns {string} JWT
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role_name,
    },
    env.jwt.secret,
    {
      expiresIn: env.jwt.expiresIn,
    }
  );
};

/**
 * Genera Refresh Token JWT.
 *
 * Uso:
 * Renovar sesión sin volver a loguearse.
 *
 * Vida útil mayor al access token.
 *
 * @param {Object} user
 * @returns {string} JWT
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      type: 'refresh',
    },
    env.jwt.secret,
    {
      expiresIn: env.jwt.refreshExpiresIn,
    }
  );
};

/**
 * Proceso principal de login.
 *
 * Flujo:
 * 1. Buscar usuario
 * 2. Validar existencia
 * 3. Validar estado activo
 * 4. Revisar bloqueo temporal
 * 5. Comparar contraseña hash
 * 6. Si falla: aumentar intentos
 * 7. Si éxito: reset intentos
 * 8. Generar tokens
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<Object>}
 */
const login = async (username, password) => {
  /**
   * Buscar usuario por username
   */
  const user = repo.findUserByUsername(username);

  if (!user) {
    throw {
      status: 401,
      message: 'Credenciales incorrectas',
    };
  }

  /**
   * Usuario inactivo
   */
  if (!user.is_active) {
    throw {
      status: 401,
      message: 'Usuario inactivo. Contacta al administrador.',
    };
  }

  /**
   * Validar bloqueo temporal
   */
  if (
    user.locked_until &&
    new Date(user.locked_until) > new Date()
  ) {
    const remaining = Math.ceil(
      (new Date(user.locked_until) - new Date()) / 60000
    );

    throw {
      status: 429,
      message: `Cuenta bloqueada. Intenta en ${remaining} minutos.`,
    };
  }

  /**
   * Comparar contraseña con hash bcrypt
   */
  const passwordValid = await bcrypt.compare(
    password,
    user.password_hash
  );

  /**
   * Contraseña incorrecta
   */
  if (!passwordValid) {
    const newAttempts = (user.login_attempts || 0) + 1;
    let lockedUntil = null;

    /**
     * Bloquear si supera máximo permitido
     */
    if (newAttempts >= MAX_ATTEMPTS) {
      const lockTime = new Date();

      lockTime.setMinutes(
        lockTime.getMinutes() + LOCK_MINUTES
      );

      lockedUntil = lockTime.toISOString();

      logger.warn(
        `Usuario ${username} bloqueado por múltiples intentos fallidos`
      );
    }

    /**
     * Guardar intentos
     */
    repo.updateLoginAttempts(
      user.id,
      newAttempts,
      lockedUntil
    );

    const remaining = MAX_ATTEMPTS - newAttempts;

    throw {
      status: 401,
      message:
        remaining > 0
          ? `Credenciales incorrectas. ${remaining} intentos restantes.`
          : 'Cuenta bloqueada por múltiples intentos fallidos.',
    };
  }

  /**
   * Login exitoso
   * Reiniciar intentos y actualizar fecha acceso
   */
  repo.updateLastLogin(user.id);

  const token = generateToken(user);
  const refreshToken = generateRefreshToken(user);

  logger.info(
    `Login exitoso: ${username} (${user.role_name})`
  );

  /**
   * Respuesta limpia para frontend
   */
  return {
    token,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role_name,
      permissions: JSON.parse(
        user.permissions || '{}'
      ),
    },
  };
};

/**
 * Renovar access token mediante refresh token.
 *
 * Flujo:
 * 1. Validar refresh token
 * 2. Confirmar tipo refresh
 * 3. Buscar usuario activo
 * 4. Emitir nuevo access token
 *
 * @param {string} token
 * @returns {Object}
 */
const refreshToken = (token) => {
  try {
    const decoded = jwt.verify(
      token,
      env.jwt.secret
    );

    if (decoded.type !== 'refresh') {
      throw new Error('Token inválido');
    }

    const user = db.prepare(`
      SELECT
        u.*,
        r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
        AND u.is_active = 1
    `).get(decoded.id);

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    return {
      token: generateToken(user),
    };
  } catch (error) {
    throw {
      status: 401,
      message: 'Refresh token inválido o expirado',
    };
  }
};

/**
 * Exportación pública del módulo.
 */
module.exports = {
  login,
  refreshToken,
};