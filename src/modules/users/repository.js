// backend/src/modules/users/repository.js

const db = require('../../config/db');

/**
 * @module UsersRepository
 * @description Capa de acceso a datos del módulo users.
 * Encargada exclusivamente de ejecutar consultas SQL sobre la entidad users.
 * No contiene lógica de negocio ni validaciones complejas.
 *
 * Maneja operaciones de lectura, creación, actualización y eliminación lógica (soft delete).
 */

/**
 * Obtiene una lista paginada de usuarios con filtros opcionales.
 *
 * @function findAll
 * @param {Object} params
 * @param {number} params.limit - Número máximo de registros a retornar.
 * @param {number} params.offset - Desplazamiento para paginación.
 * @param {string} [params.search] - Filtro por nombre o username.
 * @param {number} [params.roleId] - Filtro por rol del usuario.
 * @param {number|boolean} [params.isActive] - Filtro por estado activo.
 *
 * @returns {Object} Resultado de la consulta
 * @returns {Array<Object>} returns.rows - Lista de usuarios
 * @returns {number} returns.total - Total de registros sin paginación
 */
const findAll = ({ limit, offset, search, roleId, isActive }) => {
  let where = 'WHERE u.deleted_at IS NULL';
  const params = [];

  if (search) {
    where += ` AND (u.name LIKE ? OR u.username LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  if (roleId) {
    where += ` AND u.role_id = ?`;
    params.push(roleId);
  }

  if (isActive !== undefined) {
    where += ` AND u.is_active = ?`;
    params.push(isActive);
  }

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM users u ${where}
  `).get(...params).count;

  const rows = db.prepare(`
    SELECT u.id, u.name, u.username, u.role_id, u.is_active,
           u.last_login, u.created_at, r.name as role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    ${where}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return { rows, total };
};

/**
 * Obtiene un usuario por su ID.
 *
 * @function findById
 * @param {number} id - ID del usuario
 * @returns {Object|null} Usuario encontrado o null si no existe
 */
const findById = (id) => {
  return db.prepare(`
    SELECT u.id, u.name, u.username, u.role_id, u.is_active,
           u.last_login, u.login_attempts, u.created_at,
           r.name as role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = ? AND u.deleted_at IS NULL
  `).get(id);
};

/**
 * Crea un nuevo usuario en la base de datos.
 *
 * @function create
 * @param {Object} data
 * @param {string} data.name - Nombre del usuario
 * @param {string} data.username - Username único
 * @param {string} data.passwordHash - Password ya encriptado
 * @param {number} data.roleId - ID del rol asignado
 *
 * @returns {Object} Resultado de inserción (incluye lastInsertRowid)
 */
const create = ({ name, username, passwordHash, roleId }) => {
  return db.prepare(`
    INSERT INTO users (name, username, password_hash, role_id)
    VALUES (?, ?, ?, ?)
  `).run(name, username, passwordHash, roleId);
};

/**
 * Actualiza campos dinámicos de un usuario.
 *
 * @function update
 * @param {number} id - ID del usuario
 * @param {Object} fields - Campos a actualizar (dinámico)
 * @returns {Object} Resultado de la operación SQL
 */
const update = (id, fields) => {
  const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');

  return db.prepare(`
    UPDATE users
    SET ${setClauses}, updated_at = datetime('now')
    WHERE id = ? AND deleted_at IS NULL
  `).run(...Object.values(fields), id);
};

/**
 * Elimina un usuario de forma lógica (soft delete).
 *
 * @function softDelete
 * @param {number} id - ID del usuario
 * @returns {Object} Resultado de la operación SQL
 */
const softDelete = (id) => {
  return db.prepare(`
    UPDATE users
    SET deleted_at = datetime('now'), is_active = 0
    WHERE id = ?
  `).run(id);
};

module.exports = { findAll, findById, create, update, softDelete };