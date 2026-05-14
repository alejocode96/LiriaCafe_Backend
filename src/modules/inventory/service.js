// backend/src/modules/inventory/service.js
// ─── Servicio de movimientos de inventario ──────────────────────────────

const db = require('../../config/db');
const { buildPagination } = require('../../utils/helpers');

/**
 * @module InventoryService
 * @description Manejo de movimientos de inventario y sincronización de stock.
 *
 * Este módulo es responsable de:
 * - Registrar movimientos de inventario (entrada, salida, ajuste, etc.)
 * - Mantener consistencia del stock en la tabla products
 * - Garantizar integridad mediante transacciones SQL
 * - Proveer historial de movimientos con filtros
 */

const VALID_TYPES = [
  'entrada',
  'salida',
  'ajuste',
  'perdida',
  'venta',
  'consumo',
];

/**
 * Registra un movimiento de inventario y actualiza el stock del producto.
 *
 * IMPORTANTE:
 * Esta operación es transaccional. Si falla cualquier paso,
 * se revierte completamente para mantener consistencia.
 *
 * @function registerMovement
 *
 * @param {Object} data
 * @param {number} data.productId - ID del producto
 * @param {string} data.type - Tipo de movimiento
 * @param {number} data.quantity - Cantidad del movimiento
 * @param {number} [data.costPrice] - Costo asociado
 * @param {string} [data.reason] - Motivo del movimiento
 * @param {number|string} [data.referenceId] - Referencia externa (venta, ajuste, etc.)
 * @param {number} data.userId - Usuario que realiza el movimiento
 *
 * @throws {Object} 400 si el tipo de movimiento es inválido
 * @throws {Object} 404 si el producto no existe
 * @throws {Object} 400 si no hay stock suficiente (cuando aplica)
 *
 * @returns {Object}
 * @returns {number} stockBefore - Stock antes del movimiento
 * @returns {number} stockAfter - Stock después del movimiento
 */
const registerMovement = ({
  productId,
  type,
  quantity,
  costPrice,
  reason,
  referenceId,
  userId,
}) => {
  if (!VALID_TYPES.includes(type)) {
    throw {
      status: 400,
      message: `Tipo inválido. Válidos: ${VALID_TYPES.join(', ')}`,
    };
  }

  const moveTransaction = db.transaction(() => {
    const product = db
      .prepare(
        `SELECT * FROM products WHERE id = ? AND deleted_at IS NULL`
      )
      .get(productId);

    if (!product) {
      throw { status: 404, message: 'Producto no encontrado' };
    }

    const isOutgoing = ['salida', 'perdida', 'venta', 'consumo'].includes(
      type
    );

    const delta = isOutgoing
      ? -Math.abs(quantity)
      : Math.abs(quantity);

    /**
     * Caso especial: ajuste de inventario
     * El quantity representa el stock final deseado
     */
    if (type === 'ajuste') {
      const adjustedDelta = quantity - product.stock;
      const stockAfter = quantity;

      db.prepare(`
        INSERT INTO inventory_movements
          (product_id, type, quantity, stock_before, stock_after, cost_price,
           reason, reference_id, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        productId,
        type,
        adjustedDelta,
        product.stock,
        stockAfter,
        costPrice || product.cost_price,
        reason,
        referenceId,
        userId
      );

      db.prepare(`
        UPDATE products
        SET stock = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(stockAfter, productId);

      return {
        stockBefore: product.stock,
        stockAfter,
      };
    }

    const stockAfter = product.stock + delta;

    // Protección contra stock negativo
    if (isOutgoing && stockAfter < 0 && product.track_stock) {
      throw {
        status: 400,
        message: `Stock insuficiente. Disponible: ${product.stock}`,
      };
    }

    db.prepare(`
      INSERT INTO inventory_movements
        (product_id, type, quantity, stock_before, stock_after, cost_price,
         reason, reference_id, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      productId,
      type,
      delta,
      product.stock,
      stockAfter,
      costPrice || product.cost_price,
      reason,
      referenceId,
      userId
    );

    db.prepare(`
      UPDATE products
      SET stock = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(stockAfter, productId);

    return {
      stockBefore: product.stock,
      stockAfter,
    };
  });

  return moveTransaction();
};

/**
 * Obtiene historial de movimientos de inventario con filtros.
 *
 * @function getHistory
 *
 * @param {Object} query
 * @returns {Object} Lista paginada de movimientos
 */
const getHistory = (query) => {
  const { limit, offset, page, pageSize } = buildPagination(query);

  let where = 'WHERE 1=1';
  const params = [];

  if (query.product_id) {
    where += ` AND im.product_id = ?`;
    params.push(query.product_id);
  }

  if (query.type) {
    where += ` AND im.type = ?`;
    params.push(query.type);
  }

  if (query.from) {
    where += ` AND im.created_at >= ?`;
    params.push(query.from);
  }

  if (query.to) {
    where += ` AND im.created_at <= ?`;
    params.push(query.to + ' 23:59:59');
  }

  const total = db
    .prepare(
      `SELECT COUNT(*) as c FROM inventory_movements im ${where}`
    )
    .get(...params).c;

  const rows = db.prepare(`
    SELECT im.*, p.name as product_name, u.name as user_name
    FROM inventory_movements im
    LEFT JOIN products p ON im.product_id = p.id
    LEFT JOIN users u ON im.user_id = u.id
    ${where}
    ORDER BY im.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

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

module.exports = {
  registerMovement,
  getHistory,
};