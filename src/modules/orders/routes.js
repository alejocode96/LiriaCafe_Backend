// backend/src/modules/orders/routes.js

/**
 * @module OrdersRoutes
 * @description Rutas HTTP para la gestión de pedidos (orders).
 *
 * Este módulo expone el flujo completo del ciclo de un pedido:
 * - creación de órdenes
 * - consulta de órdenes
 * - gestión de items (agregar, actualizar, eliminar)
 * - cambio de estado del pedido
 *
 * Todas las rutas requieren autenticación y rol mínimo de staff.
 */

const { Router } = require('express');
const service = require('./service');
const { ok, created, list } = require('../../utils/response');
const { authenticate } = require('../../middlewares/auth.middleware');
const { staffOnly } = require('../../middlewares/roles.middleware');

const router = Router();

/**
 * Middleware global:
 * - Autenticación obligatoria
 * - Acceso mínimo: staff (caja, meseros, cocina)
 */
router.use(authenticate, staffOnly);

/**
 * GET /orders
 * Lista pedidos con filtros y paginación.
 */
router.get('/', (req, res, next) => {
  try {
    const result = service.getAll(req.query);
    return list(res, result.data, result.meta);
  } catch (e) {
    next(e);
  }
});

/**
 * GET /orders/:id
 * Obtiene un pedido con todos sus items asociados.
 */
router.get('/:id', (req, res, next) => {
  try {
    return ok(
      res,
      service.getOrderWithItems(+req.params.id)
    );
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({
        success: false,
        message: e.message,
      });
    }
    next(e);
  }
});

/**
 * POST /orders
 * Crea un nuevo pedido.
 *
 * Requiere:
 * - tableId (opcional)
 * - orderType
 * - notes
 *
 * El usuario se obtiene desde el token (req.user).
 */
router.post('/', (req, res, next) => {
  try {
    const order = service.createOrder({
      ...req.body,
      userId: req.user.id,
    });

    return created(res, order, 'Pedido creado');
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({
        success: false,
        message: e.message,
      });
    }
    next(e);
  }
});

/**
 * POST /orders/:id/items
 * Agrega un producto al pedido.
 *
 * Si el producto ya existe en el pedido,
 * incrementa la cantidad automáticamente.
 */
router.post('/:id/items', (req, res, next) => {
  try {
    const { product_id, quantity, notes } = req.body;

    if (!product_id || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'product_id y quantity requeridos',
      });
    }

    const order = service.addItem({
      orderId: +req.params.id,
      productId: product_id,
      quantity: parseFloat(quantity),
      notes,
    });

    return ok(res, order, 'Producto agregado');
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({
        success: false,
        message: e.message,
      });
    }
    next(e);
  }
});

/**
 * PATCH /orders/:id/items/:itemId
 * Actualiza cantidad de un item dentro del pedido.
 */
router.patch('/:id/items/:itemId', (req, res, next) => {
  try {
    const order = service.updateItemQty(
      +req.params.id,
      +req.params.itemId,
      parseFloat(req.body.quantity)
    );

    return ok(res, order, 'Cantidad actualizada');
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({
        success: false,
        message: e.message,
      });
    }
    next(e);
  }
});

/**
 * DELETE /orders/:id/items/:itemId
 * Elimina (cancela) un item del pedido.
 */
router.delete('/:id/items/:itemId', (req, res, next) => {
  try {
    const order = service.removeItem(
      +req.params.id,
      +req.params.itemId
    );

    return ok(res, order, 'Item eliminado');
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({
        success: false,
        message: e.message,
      });
    }
    next(e);
  }
});

/**
 * PATCH /orders/:id/status
 * Cambia el estado del pedido.
 *
 * Estados válidos:
 * - abierto
 * - preparando
 * - entregado
 * - pagado
 * - cancelado
 */
router.patch('/:id/status', (req, res, next) => {
  try {
    const order = service.updateStatus(
      +req.params.id,
      req.body.status
    );

    return ok(res, order, 'Estado actualizado');
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({
        success: false,
        message: e.message,
      });
    }
    next(e);
  }
});

module.exports = router;