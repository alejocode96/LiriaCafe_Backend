// backend/src/modules/sales/service.js

/**
 * @module SalesService
 * @description Módulo encargado del proceso completo de venta.
 *
 * Este es el punto de cierre del flujo POS:
 * Pedido → Pago → Venta → Descuento de inventario → Movimiento de caja
 *
 * Responsabilidades:
 * - Procesar pagos de órdenes
 * - Generar registro de venta
 * - Transferir items de order → sale
 * - Descontar inventario
 * - Registrar movimientos de caja
 * - Cerrar pedido y liberar mesa
 */

const db = require('../../config/db');
const { registerMovement } = require('../inventory/service');
const { logAudit } = require('../audit/service');
const { buildPagination } = require('../../utils/helpers');

const VALID_PAYMENTS = [
  'efectivo',
  'transferencia',
  'mixto',
];

/**
 * Procesa una venta completa desde un pedido.
 *
 * Flujo crítico del sistema POS:
 * 1. Validación del pedido
 * 2. Validación de caja abierta
 * 3. Cálculo de totales y descuentos
 * 4. Creación de registro de venta
 * 5. Copia de items del pedido a la venta
 * 6. Descuento de inventario
 * 7. Cierre del pedido
 * 8. Liberación de mesa
 * 9. Registro de movimiento de caja
 *
 * @function processSale
 * @param {Object} params
 * @returns {Object} Venta registrada
 */
const processSale = async ({
  orderId,
  paymentMethod,
  cashReceived,
  discount,
  notes,
  userId,
}) => {
  if (!VALID_PAYMENTS.includes(paymentMethod)) {
    throw {
      status: 400,
      message: `Método de pago inválido: ${VALID_PAYMENTS.join(', ')}`,
    };
  }

  const saleTransaction = db.transaction(async () => {
    const order = db
      .prepare(`
        SELECT *
        FROM orders
        WHERE id = ?
          AND status != 'pagado'
      `)
      .get(orderId);

    if (!order) {
      throw {
        status: 404,
        message: 'Pedido no encontrado o ya pagado',
      };
    }

    if (order.total <= 0) {
      throw {
        status: 400,
        message: 'El pedido no tiene productos',
      };
    }

    const cashSession = db
      .prepare(`
        SELECT *
        FROM cash_sessions
        WHERE status = 'abierta'
        LIMIT 1
      `)
      .get();

    if (!cashSession) {
      throw {
        status: 400,
        message: 'No hay caja abierta. Abre la caja primero.',
      };
    }

    const subtotal = order.subtotal;
    const discountAmount = parseFloat(discount) || 0;
    const total = subtotal - discountAmount;

    const changeGiven =
      paymentMethod === 'efectivo'
        ? Math.max(
            0,
            (cashReceived || 0) - total
          )
        : 0;

    const saleResult = db.prepare(`
      INSERT INTO sales (
        order_id,
        cash_session_id,
        user_id,
        subtotal,
        discount,
        total,
        payment_method,
        cash_received,
        change_given,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      cashSession.id,
      userId,
      subtotal,
      discountAmount,
      total,
      paymentMethod,
      cashReceived || 0,
      changeGiven,
      notes || null
    );

    const saleId = saleResult.lastInsertRowid;

    const orderItems = db.prepare(`
      SELECT oi.*,
             p.name as product_name,
             p.cost_price,
             p.track_stock
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
        AND oi.status != 'cancelado'
    `).all(orderId);

    for (const item of orderItems) {
      db.prepare(`
        INSERT INTO sale_items (
          sale_id,
          product_id,
          product_name,
          quantity,
          unit_price,
          cost_price,
          subtotal
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        saleId,
        item.product_id,
        item.product_name,
        item.quantity,
        item.unit_price,
        item.cost_price,
        item.subtotal
      );

      if (item.track_stock) {
        registerMovement({
          productId: item.product_id,
          type: 'venta',
          quantity: item.quantity,
          referenceId: saleId,
          reason: `Venta #${saleId}`,
          userId,
        });
      }
    }

    db.prepare(`
      UPDATE order_items
      SET status = 'entregado'
      WHERE order_id = ?
    `).run(orderId);

    db.prepare(`
      UPDATE orders
      SET status = 'pagado',
          closed_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(orderId);

    if (order.table_id) {
      db.prepare(`
        UPDATE tables
        SET status = 'libre',
            updated_at = datetime('now')
        WHERE id = ?
      `).run(order.table_id);
    }

    db.prepare(`
      INSERT INTO cash_movements (
        cash_session_id,
        type,
        amount,
        description,
        reference_id,
        user_id
      )
      VALUES (?, 'venta', ?, ?, ?, ?)
    `).run(
      cashSession.id,
      total,
      `Venta #${saleId} - ${paymentMethod}`,
      saleId,
      userId
    );

    return db.prepare(`
      SELECT s.*,
             u.name as user_name
      FROM sales s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).get(saleId);
  });

  return saleTransaction();
};

/**
 * Lista ventas con filtros y paginación.
 */
const getAll = (query) => {
  const { limit, offset, page, pageSize } =
    buildPagination(query);

  let where = 'WHERE 1=1';
  const params = [];

  if (query.date) {
    where += ` AND DATE(s.created_at) = ?`;
    params.push(query.date);
  }

  if (query.payment_method) {
    where += ` AND s.payment_method = ?`;
    params.push(query.payment_method);
  }

  const total = db
    .prepare(
      `SELECT COUNT(*) as c FROM sales s ${where}`
    )
    .get(...params).c;

  const rows = db.prepare(`
    SELECT s.*,
           u.name as user_name
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    ${where}
    ORDER BY s.created_at DESC
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

/**
 * Obtiene una venta con sus items.
 */
const getById = (id) => {
  const sale = db
    .prepare(`
      SELECT s.*,
             u.name as user_name
      FROM sales s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `)
    .get(id);

  if (!sale) {
    throw {
      status: 404,
      message: 'Venta no encontrada',
    };
  }

  sale.items = db
    .prepare(`
      SELECT *
      FROM sale_items
      WHERE sale_id = ?
    `)
    .all(id);

  return sale;
};

module.exports = {
  processSale,
  getAll,
  getById,
};