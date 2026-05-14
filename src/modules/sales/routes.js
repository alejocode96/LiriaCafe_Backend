// backend/src/modules/sales/routes.js

/**
 * @module SalesRoutes
 * @description Rutas HTTP para el módulo de ventas.
 *
 * Este módulo expone el flujo de cierre de ventas del POS:
 * - Consulta de ventas
 * - Detalle de venta
 * - Procesamiento de pago (conversión de orden → venta)
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
 * - Usuario autenticado
 * - Acceso mínimo: staff (caja, meseros, supervisión)
 */
router.use(authenticate, staffOnly);

/**
 * GET /sales
 * Lista ventas con filtros y paginación.
 *
 * Query params:
 * - date (YYYY-MM-DD)
 * - payment_method (efectivo | transferencia | mixto)
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
 * GET /sales/:id
 * Obtiene detalle completo de una venta:
 * - datos de la venta
 * - items incluidos
 * - usuario responsable
 */
router.get('/:id', (req, res, next) => {
  try {
    return ok(
      res,
      service.getById(+req.params.id)
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
 * POST /sales
 * Procesa el pago de un pedido (checkout).
 *
 * Este endpoint ejecuta el flujo completo de venta:
 * - valida pedido
 * - valida caja abierta
 * - calcula totales y descuentos
 * - crea registro de venta
 * - descuenta inventario
 * - cierra pedido
 * - libera mesa
 * - registra movimiento de caja
 *
 * Body:
 * - order_id (number, required)
 * - payment_method (string, required)
 * - cash_received (number, optional)
 * - discount (number, optional)
 * - notes (string, optional)
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      order_id,
      payment_method,
      cash_received,
      discount,
      notes,
    } = req.body;

    if (!order_id || !payment_method) {
      return res.status(400).json({
        success: false,
        message: 'order_id y payment_method son requeridos',
      });
    }

    const sale = await service.processSale({
      orderId: order_id,
      paymentMethod: payment_method,
      cashReceived: cash_received,
      discount,
      notes,
      userId: req.user.id,
    });

    return created(res, sale, 'Venta procesada exitosamente');
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