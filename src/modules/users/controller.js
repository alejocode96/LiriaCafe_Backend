// backend/src/modules/users/controller.js

const service = require('./service');
const { ok, created, list, serverError } = require('../../utils/response');
const { logAudit } = require('../audit/service');

/**
 * @module UsersController
 * @description Capa HTTP del módulo users.
 * Se encarga de recibir requests, delegar lógica al service,
 * formatear respuestas y registrar auditoría de acciones críticas.
 */

/**
 * Obtiene lista de usuarios con paginación.
 *
 * @route GET /users
 * @access Private (supervisor+)
 */
const getAll = (req, res, next) => {
  try {
    const result = service.getAll(req.query);
    return list(res, result.data, result.meta);
  } catch (e) {
    next(e);
  }
};

/**
 * Obtiene un usuario por ID.
 *
 * @route GET /users/:id
 * @access Private (supervisor+)
 */
const getById = (req, res, next) => {
  try {
    const user = service.getById(parseInt(req.params.id));
    return ok(res, user);
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({
        success: false,
        message: e.message,
      });
    }
    next(e);
  }
};

/**
 * Crea un nuevo usuario.
 * Registra auditoría del evento CREATE.
 *
 * @route POST /users
 * @access Private (admin)
 */
const create = async (req, res, next) => {
  try {
    const user = await service.create(req.body);

    await logAudit({
      userId: req.user.id,
      action: 'CREATE',
      module: 'users',
      targetId: user.id,
    });

    return created(res, user, 'Usuario creado');
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({
        success: false,
        message: e.message,
      });
    }
    next(e);
  }
};

/**
 * Actualiza un usuario existente.
 * Registra auditoría del evento UPDATE.
 *
 * @route PUT /users/:id
 * @access Private (admin)
 */
const update = async (req, res, next) => {
  try {
    const user = await service.update(
      parseInt(req.params.id),
      req.body
    );

    await logAudit({
      userId: req.user.id,
      action: 'UPDATE',
      module: 'users',
      targetId: user.id,
    });

    return ok(res, user, 'Usuario actualizado');
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({
        success: false,
        message: e.message,
      });
    }
    next(e);
  }
};

/**
 * Elimina un usuario (soft delete).
 * Registra auditoría del evento DELETE.
 *
 * @route DELETE /users/:id
 * @access Private (admin)
 */
const remove = async (req, res, next) => {
  try {
    service.remove(
      parseInt(req.params.id),
      req.user.id
    );

    await logAudit({
      userId: req.user.id,
      action: 'DELETE',
      module: 'users',
      targetId: req.params.id,
    });

    return ok(res, null, 'Usuario eliminado');
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({
        success: false,
        message: e.message,
      });
    }
    next(e);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};