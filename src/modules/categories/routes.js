// backend/src/modules/categories/routes.js

const { Router } = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { adminOnly, staffOnly } = require('../../middlewares/roles.middleware');
const db = require('../../config/db');
const { ok, created, list, notFound } = require('../../utils/response');
const { logAudit } = require('../audit/service');

const router = Router();

/**
 * @module CategoriesRoutes
 * @description Manejo de categorías del sistema.
 * Permite listar, consultar, crear y actualizar categorías de productos.
 *
 * Seguridad:
 * - Todas las rutas requieren autenticación JWT
 * - Lectura disponible para staff o superior
 * - Escritura restringida a administradores
 */

router.use(authenticate);

/**
 * GET /categories
 * @description Lista todas las categorías activas con conteo de productos asociados
 * @access staff+
 */
router.get('/', staffOnly, (req, res) => {
  const categories = db.prepare(`
    SELECT c.*, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p
      ON p.category_id = c.id
      AND p.deleted_at IS NULL
      AND p.is_active = 1
    WHERE c.is_active = 1
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.name ASC
  `).all();

  return list(res, categories);
});

/**
 * GET /categories/:id
 * @description Obtiene una categoría por ID
 * @access staff+
 */
router.get('/:id', staffOnly, (req, res) => {
  const cat = db.prepare(`
    SELECT * FROM categories WHERE id = ?
  `).get(req.params.id);

  if (!cat) {
    return notFound(res, 'Categoría no encontrada');
  }

  return ok(res, cat);
});

/**
 * POST /categories
 * @description Crea una nueva categoría
 * @access admin only
 */
router.post('/', adminOnly, (req, res, next) => {
  try {
    const {
      name,
      description,
      color,
      icon,
      sort_order,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Nombre requerido',
      });
    }

    const result = db.prepare(`
      INSERT INTO categories
      (name, description, color, icon, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      name,
      description || null,
      color || '#6B7280',
      icon || null,
      sort_order || 0
    );

    const cat = db.prepare(`
      SELECT * FROM categories WHERE id = ?
    `).get(result.lastInsertRowid);

    logAudit({
      userId: req.user.id,
      action: 'CREATE',
      module: 'categories',
      targetId: cat.id,
    });

    return created(res, cat, 'Categoría creada');
  } catch (e) {
    next(e);
  }
});

/**
 * PUT /categories/:id
 * @description Actualiza una categoría existente
 * @access admin only
 */
router.put('/:id', adminOnly, (req, res, next) => {
  try {
    const {
      name,
      description,
      color,
      icon,
      sort_order,
      is_active,
    } = req.body;

    db.prepare(`
      UPDATE categories
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          color = COALESCE(?, color),
          icon = COALESCE(?, icon),
          sort_order = COALESCE(?, sort_order),
          is_active = COALESCE(?, is_active),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name,
      description,
      color,
      icon,
      sort_order,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      req.params.id
    );

    const cat = db.prepare(`
      SELECT * FROM categories WHERE id = ?
    `).get(req.params.id);

    logAudit({
      userId: req.user.id,
      action: 'UPDATE',
      module: 'categories',
      targetId: cat.id,
    });

    return ok(res, cat, 'Categoría actualizada');
  } catch (e) {
    next(e);
  }
});

module.exports = router;