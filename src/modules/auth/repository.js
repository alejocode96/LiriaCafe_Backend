// backend/src/modules/auth/repository.js
// ─────────────────────────────────────────────────────────────
// CAPA REPOSITORY - Módulo de Autenticación
// -------------------------------------------------------------
// Responsabilidad:
// Centralizar todas las consultas SQL relacionadas con login,
// bloqueo de usuario e historial básico de acceso.
//
// Esta capa NO contiene lógica de negocio.
// Solo consulta y persiste datos.
//
// Beneficios:
// - Separa SQL del service/controller
// - Facilita mantenimiento
// - Permite refactor futuro a PostgreSQL/MySQL
// - Código más limpio y testeable
//
// Patrón aplicado:
// Controller -> Service -> Repository -> DB
// ─────────────────────────────────────────────────────────────

const db = require('../../config/db');

/**
 * Buscar usuario por username.
 *
 * Incluye:
 * - Datos del usuario
 * - Nombre del rol
 * - Permisos del rol
 *
 * Reglas:
 * - Excluye usuarios eliminados lógicamente (soft delete)
 *
 * Uso típico:
 * Login con usuario y contraseña.
 *
 * @param {string} username - Nombre de usuario
 * @returns {Object|undefined} Usuario encontrado o undefined
 */
const findUserByUsername = (username) => {
  return db.prepare(`
    SELECT
      u.*,
      r.name as role_name,
      r.permissions
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.username = ?
      AND u.deleted_at IS NULL
  `).get(username);
};

/**
 * Actualizar intentos fallidos de login.
 *
 * También permite establecer bloqueo temporal.
 *
 * Casos comunes:
 * - Contraseña incorrecta
 * - Límite de intentos excedido
 *
 * @param {number} userId - ID usuario
 * @param {number} attempts - Cantidad de intentos acumulados
 * @param {string|null} lockedUntil - Fecha/hora fin bloqueo
 * @returns {Object} Resultado SQLite (.run)
 */
const updateLoginAttempts = (userId, attempts, lockedUntil = null) => {
  return db.prepare(`
    UPDATE users
    SET
      login_attempts = ?,
      locked_until = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(attempts, lockedUntil, userId);
};

/**
 * Registrar login exitoso.
 *
 * Acciones realizadas:
 * - Guarda fecha/hora último acceso
 * - Reinicia intentos fallidos
 * - Elimina bloqueo temporal
 *
 * Se ejecuta después de autenticar credenciales válidas.
 *
 * @param {number} userId - ID usuario
 * @returns {Object} Resultado SQLite (.run)
 */
const updateLastLogin = (userId) => {
  return db.prepare(`
    UPDATE users
    SET
      last_login = datetime('now'),
      login_attempts = 0,
      locked_until = NULL
    WHERE id = ?
  `).run(userId);
};

/**
 * Exportación pública del repository.
 */
module.exports = {
  findUserByUsername,
  updateLoginAttempts,
  updateLastLogin,
};