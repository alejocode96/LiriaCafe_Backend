// backend/src/modules/inventory/routes.js

const { Router } = require('express');
const service = require('./service');
const { ok, created, list } = require('../../utils/response');
const { authenticate } = require('../../middlewares/auth.middleware');
const {
  supervisorUp,
  staffOnly,
} = require('../../middlewares/roles.middleware');
const { logAudit } = require('../audit/service');

const router = Router();

/**
 * @module InventoryRoutes
 * @description Rutas HTTP para gestión de movimientos de inventario.
 *
 * Este módulo permite:
 * - Consultar historial de movimientos
 * - Registrar movimientos manuales de inventario (ajustes operativos)
 *
 * Todas las rutas requieren autenticación JWT.
 * El acceso está restringido por roles.
 */

router.use(authenticate);

/**
 * GET /inventory
 * @description Obtiene historial de movimientos de inventario con filtros
 * @access staff+
 */
router.get('/', staffOnly, (req, res, next) => {
  try {
    const result = service.getHistory(req.query);
    return list(res, result.data, result.meta);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /inventory
 * @description Registra un movimiento manual de inventario
 * (entradas, salidas, ajustes, pérdidas, etc. que no provienen de ventas)
 *
 * @access supervisor+
 */
router.post('/', supervisorUp, (req, res, next) => {
  try {
    const {
      product_id,
      type,
      quantity,
      cost_price,
      reason,
    } = req.body;

    // Validación mínima de integridad
    if (!product_id || !type || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'product_id, type y quantity son requeridos',
      });
    }

    const result = service.registerMovement({
      productId: product_id,
      type,
      quantity: parseFloat(quantity),
      costPrice: cost_price,
      reason,
      userId: req.user.id,
    });

    /**
     * Auditoría del evento de inventario
     * Permite trazabilidad de cambios manuales sobre stock
     */
    logAudit({
      userId: req.user.id,
      action: 'INVENTORY_MOVE',
      module: 'inventory',
      targetId: product_id,
      payload: {
        type,
        quantity,
        reason,
      },
    });

    return created(res, result, 'Movimiento registrado');
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