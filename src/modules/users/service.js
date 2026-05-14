// backend/src/modules/users/service.js

const bcrypt = require('bcrypt');
const repo = require('./repository');

/**
 * @module UsersService
 * @description Capa de lógica de negocio del módulo users.
 * Encargada de validaciones, reglas de negocio y transformación de datos
 * antes de interactuar con el repositorio.
 */

/**
 * Obtiene usuarios con paginación y filtros.
 *
 * @function getAll
 * @param {Object} query - Query params HTTP
 * @returns {Object} Resultado paginado con metadata
 */
const getAll = (query) => {
  const { buildPagination } = require('../../utils/helpers');

  const { limit, offset, page, pageSize } = buildPagination(query);

  const { rows, total } = repo.findAll({
    limit,
    offset,
    search: query.search,
    roleId: query.role_id ? parseInt(query.role_id) : undefined,
    isActive:
      query.active !== undefined
        ? query.active === 'true'
          ? 1
          : 0
        : undefined,
  });

  return {
    data: rows,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

/**
 * Obtiene un usuario por ID.
 *
 * @function getById
 * @param {number} id
 * @throws {Object} error 404 si el usuario no existe
 * @returns {Object} Usuario encontrado
 */
const getById = (id) => {
  const user = repo.findById(id);

  if (!user) {
    throw { status: 404, message: 'Usuario no encontrado' };
  }

  return user;
};

/**
 * Crea un nuevo usuario con password encriptado.
 *
 * @function create
 * @param {Object} data
 * @param {string} data.name
 * @param {string} data.username
 * @param {string} data.password
 * @param {number} data.role_id
 *
 * @throws {Object} error 400 si faltan campos obligatorios
 * @returns {Object} Usuario creado
 */
const create = async ({ name, username, password, role_id }) => {
  if (!name || !username || !password || !role_id) {
    throw { status: 400, message: 'Faltan campos requeridos' };
  }

   // Validación de longitud y complejidad mínima
  if (password.length < 8) {
    throw { status: 400, message: 'La contraseña debe tener al menos 8 caracteres' };
  }
  if (username.length < 3) {
    throw { status: 400, message: 'El usuario debe tener al menos 3 caracteres' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw { status: 400, message: 'Usuario solo puede contener letras, números y guion bajo' };
  }
  
  const passwordHash = await bcrypt.hash(password, 12);

  const result = repo.create({
    name,
    username,
    passwordHash,
    roleId: role_id,
  });

  return repo.findById(result.lastInsertRowid);
};

/**
 * Actualiza un usuario existente.
 * Permite actualización parcial de campos.
 *
 * @function update
 * @param {number} id
 * @param {Object} body
 *
 * @throws {Object} error 404 si usuario no existe
 * @throws {Object} error 400 si no hay campos para actualizar
 * @returns {Object} Usuario actualizado
 */
const update = async (id, body) => {
  const user = repo.findById(id);

  if (!user) {
    throw { status: 404, message: 'Usuario no encontrado' };
  }

  const fields = {};

  if (body.name) fields.name = body.name;
  if (body.role_id) fields.role_id = body.role_id;
  if (body.is_active !== undefined) {
    fields.is_active = body.is_active ? 1 : 0;
  }

  if (body.password) {
    fields.password_hash = await bcrypt.hash(body.password, 12);
  }

  if (Object.keys(fields).length === 0) {
    throw { status: 400, message: 'No hay campos para actualizar' };
  }

  repo.update(id, fields);

  return repo.findById(id);
};

/**
 * Elimina un usuario mediante soft delete.
 *
 * @function remove
 * @param {number} id - Usuario objetivo
 * @param {number} requesterId - Usuario que realiza la acción
 *
 * @throws {Object} error 400 si intenta eliminarse a sí mismo
 * @throws {Object} error 404 si el usuario no existe
 */
const remove = (id, requesterId) => {
  if (id === requesterId) {
    throw { status: 400, message: 'No puedes eliminarte a ti mismo' };
  }

  const user = repo.findById(id);

  if (!user) {
    throw { status: 404, message: 'Usuario no encontrado' };
  }

  repo.softDelete(id);
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};