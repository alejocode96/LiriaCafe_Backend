// backend/src/modules/products/controller.js

const service = require('./service');
const { ok, created, list } = require('../../utils/response');
const { logAudit } = require('../audit/service');

/**
 * @module ProductsController
 * @description Capa HTTP del módulo products.
 * Se encarga de recibir requests, delegar lógica al service,
 * estructurar respuestas y registrar auditoría de acciones críticas.
 */

/**
 * Obtiene lista de productos con filtros y paginación.
 *
 * @route GET /products
 * @access Private
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
 * Obtiene un producto por ID.
 *
 * @route GET /products/:id
 * @access Private
 */
const getById = (req, res, next) => {
  try {
    return ok(res, service.getById(+req.params.id));
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
 * Crea un nuevo producto.
 * Registra auditoría del evento CREATE.
 *
 * @route POST /products
 * @access Private (admin/staff según middleware externo)
 */
const create = async (req, res, next) => {
  try {
    const p = service.create(req.body);

    await logAudit({
      userId: req.user.id,
      action: 'CREATE',
      module: 'products',
      targetId: p.id,
    });

    return created(res, p, 'Producto creado');
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
 * Actualiza un producto existente.
 * Registra auditoría del evento UPDATE.
 *
 * @route PUT /products/:id
 * @access Private
 */
const update = async (req, res, next) => {
  try {
    const p = service.update(+req.params.id, req.body);

    await logAudit({
      userId: req.user.id,
      action: 'UPDATE',
      module: 'products',
      targetId: p.id,
    });

    return ok(res, p, 'Producto actualizado');
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
 * Elimina un producto (soft delete).
 * Registra auditoría del evento DELETE.
 *
 * @route DELETE /products/:id
 * @access Private
 */
const remove = async (req, res, next) => {
  try {
    service.remove(+req.params.id);

    await logAudit({
      userId: req.user.id,
      action: 'DELETE',
      module: 'products',
      targetId: req.params.id,
    });

    return ok(res, null, 'Producto eliminado');
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