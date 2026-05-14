// backend/src/modules/products/service.js

const repo = require('./repository');
const { buildPagination } = require('../../utils/helpers');

/**
 * @module ProductsService
 * @description Capa de lógica de negocio del módulo products.
 * Encargada de validaciones, transformación de datos y reglas de negocio
 * antes de interactuar con el repositorio.
 */

/**
 * Obtiene productos con filtros y paginación.
 *
 * @function getAll
 * @param {Object} query - Query params HTTP
 * @returns {Object} Resultado paginado con metadata
 */
const getAll = (query) => {
  const { limit, offset, page, pageSize } = buildPagination(query);

  const { rows, total } = repo.findAll({
    limit,
    offset,
    search: query.search,
    categoryId: query.category_id
      ? parseInt(query.category_id)
      : undefined,
    active: query.active !== undefined
      ? query.active === 'true'
        ? 1
        : 0
      : undefined,
    lowStock: query.low_stock === 'true',
  });

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
 * Obtiene un producto por ID.
 *
 * @function getById
 * @param {number} id
 * @throws {Object} 404 si el producto no existe
 * @returns {Object} Producto encontrado
 */
const getById = (id) => {
  const p = repo.findById(id);

  if (!p) {
    throw { status: 404, message: 'Producto no encontrado' };
  }

  return p;
};

/**
 * Crea un nuevo producto.
 * Aplica normalización de datos y valores por defecto.
 *
 * @function create
 * @param {Object} data
 * @throws {Object} 400 si faltan campos obligatorios
 * @returns {Object} Producto creado
 */
const create = (data) => {
  if (!data.name || !data.sale_price) {
    throw {
      status: 400,
      message: 'Nombre y precio de venta son requeridos',
    };
  }

  const payload = {
    name: data.name,
    description: data.description || null,
    category_id: data.category_id || null,
    cost_price: parseFloat(data.cost_price) || 0,
    sale_price: parseFloat(data.sale_price),
    stock: parseFloat(data.stock) || 0,
    min_stock: parseFloat(data.min_stock) || 0,
    unit: data.unit || 'unidad',
    barcode: data.barcode || null,
    is_active: 1,
    track_stock: data.track_stock !== false ? 1 : 0,
  };

  const result = repo.create(payload);

  return repo.findById(result.lastInsertRowid);
};

/**
 * Actualiza un producto existente.
 * Solo permite campos definidos en whitelist.
 *
 * @function update
 * @param {number} id
 * @param {Object} data
 * @throws {Object} 400 si no hay campos válidos para actualizar
 * @returns {Object} Producto actualizado
 */
const update = (id, data) => {
  // Validación de existencia
  getById(id);

  const allowed = [
    'name',
    'description',
    'category_id',
    'cost_price',
    'sale_price',
    'stock',
    'min_stock',
    'unit',
    'barcode',
    'is_active',
    'track_stock',
    'image_url',
  ];

  const fields = {};

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields[key] = data[key];
    }
  }

  if (Object.keys(fields).length === 0) {
    throw {
      status: 400,
      message: 'Sin campos para actualizar',
    };
  }

  repo.update(id, fields);

  return repo.findById(id);
};

/**
 * Elimina un producto mediante soft delete.
 *
 * @function remove
 * @param {number} id
 * @returns {void}
 */
const remove = (id) => {
  getById(id);
  repo.softDelete(id);
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};