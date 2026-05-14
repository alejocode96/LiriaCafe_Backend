// backend/src/modules/products/repository.js

const db = require('../../config/db');

/**
 * @module ProductsRepository
 * @description Capa de acceso a datos del módulo products.
 * Encargada exclusivamente de consultas SQL sobre productos.
 * No contiene lógica de negocio.
 *
 * Maneja búsqueda, filtrado, creación, actualización y control de stock.
 */

/**
 * Obtiene productos con filtros y paginación.
 *
 * @function findAll
 * @param {Object} params
 * @param {number} params.limit - Límite de resultados
 * @param {number} params.offset - Desplazamiento de paginación
 * @param {string} [params.search] - Búsqueda por nombre o código de barras
 * @param {number} [params.categoryId] - Filtra por categoría
 * @param {number|boolean} [params.active] - Estado del producto
 * @param {boolean} [params.lowStock] - Filtra productos con stock bajo
 *
 * @returns {Object}
 * @returns {Array<Object>} returns.rows - Lista de productos
 * @returns {number} returns.total - Total de registros
 */
const findAll = ({ limit, offset, search, categoryId, active, lowStock }) => {
  let where = 'WHERE p.deleted_at IS NULL';
  const params = [];

  if (search) {
    where += ` AND (p.name LIKE ? OR p.barcode LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  if (categoryId) {
    where += ` AND p.category_id = ?`;
    params.push(categoryId);
  }

  if (active !== undefined) {
    where += ` AND p.is_active = ?`;
    params.push(active);
  }

  if (lowStock) {
    where += ` AND p.track_stock = 1 AND p.stock <= p.min_stock`;
  }

  const total = db.prepare(`
    SELECT COUNT(*) as c FROM products p ${where}
  `).get(...params).c;

  const rows = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ${where}
    ORDER BY p.name ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return { rows, total };
};

/**
 * Obtiene un producto por ID.
 *
 * @function findById
 * @param {number} id
 * @returns {Object|null}
 */
const findById = (id) => db.prepare(`
  SELECT p.*, c.name as category_name
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE p.id = ? AND p.deleted_at IS NULL
`).get(id);

/**
 * Crea un nuevo producto.
 *
 * @function create
 * @param {Object} data - Datos del producto
 * @returns {Object} Resultado de inserción
 */
const create = (data) => db.prepare(`
  INSERT INTO products (
    name, description, category_id,
    cost_price, sale_price,
    stock, min_stock,
    unit, barcode,
    is_active, track_stock
  )
  VALUES (
    @name, @description, @category_id,
    @cost_price, @sale_price,
    @stock, @min_stock,
    @unit, @barcode,
    @is_active, @track_stock
  )
`).run(data);

/**
 * Actualiza un producto dinámicamente.
 *
 * @function update
 * @param {number} id
 * @param {Object} data
 * @returns {Object}
 */
const update = (id, data) => {
  const fields = Object.keys(data)
    .map(k => `${k} = @${k}`)
    .join(', ');

  return db.prepare(`
    UPDATE products
    SET ${fields}, updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...data, id });
};

/**
 * Eliminación lógica de producto.
 *
 * @function softDelete
 * @param {number} id
 * @returns {Object}
 */
const softDelete = (id) => db.prepare(`
  UPDATE products
  SET deleted_at = datetime('now'),
      is_active = 0
  WHERE id = ?
`).run(id);

/**
 * Actualiza el stock de un producto.
 *
 * @function updateStock
 * @param {number} id
 * @param {number} newStock
 * @returns {Object}
 */
const updateStock = (id, newStock) => db.prepare(`
  UPDATE products
  SET stock = ?,
      updated_at = datetime('now')
  WHERE id = ?
`).run(newStock, id);

module.exports = {
  findAll,
  findById,
  create,
  update,
  softDelete,
  updateStock,
};