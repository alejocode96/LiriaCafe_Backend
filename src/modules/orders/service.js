// backend/src/modules/orders/service.js
// ─── Lógica de pedidos con control transaccional ───────────────────

const db = require('../../config/db');
const { buildPagination } = require('../../utils/helpers');

/**
 * @module OrdersService
 * @description Manejo completo de pedidos (orders) y sus items.
 *
 * Este módulo es el núcleo operativo del POS:
 * - Creación de pedidos por mesa o tipo de orden
 * - Gestión de items del pedido
 * - Cálculo automático de totales
 * - Control de estados del pedido
 * - Liberación de mesas según estado
 *
 * Garantiza consistencia entre órdenes, mesas y productos.
 */

const VALID_STATUS = [
  'abierto',
  'preparando',
  'entregado',
  'pagado',
  'cancelado',
];

/**
 * Recalcula subtotal y total de un pedido.
 *
 * @function recalculateOrder
 * @param {number} orderId
 * @returns {Object} Pedido actualizado
 */
const recalculateOrder = (orderId) => {
  const items = db
    .prepare(`
      SELECT subtotal
      FROM order_items
      WHERE order_id = ? AND status != 'cancelado'
    `)
    .all(orderId);

  const subtotal = items.reduce(
    (sum, i) => sum + i.subtotal,
    0
  );

  db.prepare(`
    UPDATE orders
    SET subtotal = ?,
        total = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(subtotal, subtotal, orderId);

  return db
    .prepare(`SELECT * FROM orders WHERE id = ?`)
    .get(orderId);
};

/**
 * Crea un nuevo pedido.
 *
 * Si el pedido está asociado a una mesa:
 * - valida existencia de la mesa
 * - valida que no tenga pedidos abiertos
 * - marca la mesa como ocupada
 *
 * @function createOrder
 * @param {Object} data
 * @returns {Object} Orden creada
 */
const createOrder = ({
  tableId,
  orderType,
  notes,
  userId,
}) => {
  if (tableId) {
    const table = db
      .prepare(`SELECT * FROM tables WHERE id = ?`)
      .get(tableId);

    if (!table) {
      throw { status: 404, message: 'Mesa no encontrada' };
    }

    const existing = db
      .prepare(`
        SELECT id
        FROM orders
        WHERE table_id = ? AND status = 'abierto'
      `)
      .get(tableId);

    if (existing) {
      throw {
        status: 409,
        message: `Mesa ya tiene pedido abierto #${existing.id}`,
      };
    }

    db.prepare(`
      UPDATE tables
      SET status = 'ocupada',
          updated_at = datetime('now')
      WHERE id = ?
    `).run(tableId);
  }

  const result = db.prepare(`
    INSERT INTO orders (
      table_id,
      user_id,
      order_type,
      notes,
      status
    )
    VALUES (?, ?, ?, ?, 'abierto')
  `).run(
    tableId || null,
    userId,
    orderType || 'mesa',
    notes || null
  );

  return db
    .prepare(`
      SELECT o.*,
             t.name as table_name,
             u.name as user_name
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `)
    .get(result.lastInsertRowid);
};

/**
 * Agrega un item a un pedido.
 * Si el producto ya existe, incrementa cantidad.
 *
 * @function addItem
 */
const addItem = ({
  orderId,
  productId,
  quantity,
  notes,
}) => {
  const order = db
    .prepare(`SELECT * FROM orders WHERE id = ?`)
    .get(orderId);

  if (!order) {
    throw { status: 404, message: 'Pedido no encontrado' };
  }

  if (!['abierto', 'preparando'].includes(order.status)) {
    throw {
      status: 400,
      message: `No se puede modificar pedido en estado: ${order.status}`,
    };
  }

  const product = db
    .prepare(`
      SELECT *
      FROM products
      WHERE id = ?
        AND is_active = 1
        AND deleted_at IS NULL
    `)
    .get(productId);

  if (!product) {
    throw {
      status: 404,
      message: 'Producto no encontrado o inactivo',
    };
  }

  const existing = db
    .prepare(`
      SELECT *
      FROM order_items
      WHERE order_id = ?
        AND product_id = ?
        AND status != 'cancelado'
    `)
    .get(orderId, productId);

  if (existing) {
    const newQty = existing.quantity + quantity;

    db.prepare(`
      UPDATE order_items
      SET quantity = ?,
          subtotal = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      newQty,
      newQty * existing.unit_price,
      existing.id
    );
  } else {
    db.prepare(`
      INSERT INTO order_items (
        order_id,
        product_id,
        quantity,
        unit_price,
        subtotal,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      productId,
      quantity,
      product.sale_price,
      quantity * product.sale_price,
      notes || null
    );
  }

  return recalculateOrder(orderId);
};

/**
 * Elimina (cancela) un item del pedido.
 */
const removeItem = (orderId, itemId) => {
  const item = db
    .prepare(`
      SELECT *
      FROM order_items
      WHERE id = ? AND order_id = ?
    `)
    .get(itemId, orderId);

  if (!item) {
    throw { status: 404, message: 'Item no encontrado' };
  }

  db.prepare(`
    UPDATE order_items
    SET status = 'cancelado',
        updated_at = datetime('now')
    WHERE id = ?
  `).run(itemId);

  return recalculateOrder(orderId);
};

/**
 * Actualiza cantidad de un item.
 */
const updateItemQty = (orderId, itemId, quantity) => {
  if (quantity <= 0) {
    return removeItem(orderId, itemId);
  }

  const item = db
    .prepare(`
      SELECT *
      FROM order_items
      WHERE id = ? AND order_id = ?
    `)
    .get(itemId, orderId);

  if (!item) {
    throw { status: 404, message: 'Item no encontrado' };
  }

  db.prepare(`
    UPDATE order_items
    SET quantity = ?,
        subtotal = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    quantity,
    quantity * item.unit_price,
    itemId
  );

  return recalculateOrder(orderId);
};

/**
 * Actualiza estado del pedido.
 * Libera mesa si se paga o cancela.
 */
const updateStatus = (orderId, status) => {
  if (!VALID_STATUS.includes(status)) {
    throw {
      status: 400,
      message: `Status inválido. Válidos: ${VALID_STATUS.join(', ')}`,
    };
  }

  const order = db
    .prepare(`SELECT * FROM orders WHERE id = ?`)
    .get(orderId);

  if (!order) {
    throw { status: 404, message: 'Pedido no encontrado' };
  }

  db.prepare(`
    UPDATE orders
    SET status = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(status, orderId);

  if (
    ['pagado', 'cancelado'].includes(status) &&
    order.table_id
  ) {
    db.prepare(`
      UPDATE tables
      SET status = 'libre',
          updated_at = datetime('now')
      WHERE id = ?
    `).run(order.table_id);
  }

  return db
    .prepare(`SELECT * FROM orders WHERE id = ?`)
    .get(orderId);
};

/**
 * Obtiene pedido con items.
 */
const getOrderWithItems = (orderId) => {
  const order = db
    .prepare(`
      SELECT o.*,
             t.name as table_name,
             u.name as user_name
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `)
    .get(orderId);

  if (!order) {
    throw { status: 404, message: 'Pedido no encontrado' };
  }

  order.items = db
    .prepare(`
      SELECT oi.*,
             p.name as product_name,
             c.name as category_name
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE oi.order_id = ?
        AND oi.status != 'cancelado'
      ORDER BY oi.created_at ASC
    `)
    .all(orderId);

  return order;
};

/**
 * Lista pedidos con filtros.
 */
const getAll = (query) => {
  const { limit, offset, page, pageSize } =
    buildPagination(query);

  let where = 'WHERE 1=1';
  const params = [];

  if (query.status) {
    where += ` AND o.status = ?`;
    params.push(query.status);
  }

  if (query.table_id) {
    where += ` AND o.table_id = ?`;
    params.push(query.table_id);
  }

  if (query.date) {
    where += ` AND DATE(o.created_at) = ?`;
    params.push(query.date);
  }

  const total = db
    .prepare(
      `SELECT COUNT(*) as c FROM orders o ${where}`
    )
    .get(...params).c;

  const rows = db.prepare(`
    SELECT o.*,
           t.name as table_name,
           u.name as user_name
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    LEFT JOIN users u ON o.user_id = u.id
    ${where}
    ORDER BY o.created_at DESC
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
  createOrder,
  addItem,
  removeItem,
  updateItemQty,
  updateStatus,
  getOrderWithItems,
  getAll,
};