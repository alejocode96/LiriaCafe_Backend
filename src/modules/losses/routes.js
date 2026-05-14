// backend/src/modules/losses/routes.js

/**
 * @module LossesRoutes
 * @description Módulo de registro y consulta de pérdidas de inventario.
 *
 * Este módulo permite:
 * - Registrar pérdidas de productos
 * - Clasificar motivos (robo, daño, vencido, etc.)
 * - Descontar inventario automáticamente
 * - Calcular impacto en costos
 * - Auditar eventos críticos
 *
 * Es clave para control de merma y control financiero del inventario.
 */

const { Router } = require('express');
const db = require('../../config/db');
const { ok, created, list } = require('../../utils/response');
const { authenticate } = require('../../middlewares/auth.middleware');
const { supervisorUp } = require('../../middlewares/roles.middleware');
const { registerMovement } = require('../inventory/service');
const { logAudit } = require('../audit/service');
const { buildPagination } = require('../../utils/helpers');

const router = Router();

/**
 * Seguridad global:
 * Solo supervisores o superiores pueden registrar o ver pérdidas.
 */
router.use(authenticate, supervisorUp);

/**
 * Tipos de pérdida permitidos en el sistema.
 */
const VALID_REASONS = ['robo', 'daño', 'vencido', 'consumo_interno', 'error', 'otro'];

/**
 * GET /losses
 * Lista pérdidas con filtros y paginación.
 *
 * Query params:
 * - reason (string)
 * - from (date)
 * - to (date)
 */
router.get('/', (req, res, next) => {
  try {
    const { limit, offset, page, pageSize } = buildPagination(req.query);

    let where = 'WHERE 1=1';
    const params = [];

    if (req.query.reason) {
      where += ` AND l.reason = ?`;
      params.push(req.query.reason);
    }

    if (req.query.from) {
      where += ` AND l.created_at >= ?`;
      params.push(req.query.from);
    }

    if (req.query.to) {
      where += ` AND l.created_at <= ?`;
      params.push(req.query.to + ' 23:59:59');
    }

    const total = db.prepare(`
      SELECT COUNT(*) as c FROM losses l ${where}
    `).get(...params).c;

    const rows = db.prepare(`
      SELECT l.*, p.name as product_name, u.name as user_name
      FROM losses l
      LEFT JOIN products p ON l.product_id = p.id
      LEFT JOIN users u ON l.user_id = u.id
      ${where}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return list(res, rows, {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /losses
 * Registra una pérdida de inventario.
 *
 * Flujo:
 * 1. valida producto
 * 2. valida motivo
 * 3. calcula impacto en costo
 * 4. registra pérdida
 * 5. descuenta inventario (inventory movement)
 * 6. registra auditoría
 *
 * Body:
 * - product_id (number)
 * - quantity (number)
 * - reason (string)
 * - description (string, optional)
 */
router.post('/', async (req, res, next) => {
  try {
    const { product_id, quantity, reason, description } = req.body;

    if (!product_id || !quantity || !reason) {
      return res.status(400).json({
        success: false,
        message: 'product_id, quantity y reason son requeridos',
      });
    }

    if (!VALID_REASONS.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: `Razón inválida. Válidas: ${VALID_REASONS.join(', ')}`,
      });
    }

    const product = db.prepare(`
      SELECT * FROM products WHERE id = ? AND deleted_at IS NULL
    `).get(product_id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado',
      });
    }

    const costImpact = parseFloat(quantity) * product.cost_price;

    const result = db.prepare(`
      INSERT INTO losses
        (product_id, quantity, cost_impact, reason, description, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      product_id,
      quantity,
      costImpact,
      reason,
      description || null,
      req.user.id
    );

    // Descuento en inventario si aplica control de stock
    if (product.track_stock) {
      registerMovement({
        productId: product_id,
        type: 'perdida',
        quantity: parseFloat(quantity),
        reason: `Pérdida: ${reason} - ${description || ''}`,
        userId: req.user.id,
      });
    }

    const loss = db.prepare(`
      SELECT * FROM losses WHERE id = ?
    `).get(result.lastInsertRowid);

    await logAudit({
      userId: req.user.id,
      action: 'CREATE',
      module: 'losses',
      targetId: loss.id,
      payload: {
        product_id,
        quantity,
        reason,
        cost_impact: costImpact,
      },
    });

    return created(res, loss, 'Pérdida registrada');
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