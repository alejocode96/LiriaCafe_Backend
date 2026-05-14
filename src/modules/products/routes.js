// backend/src/modules/products/routes.js

const { Router } = require('express');
const controller = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const {
  adminOnly,
  supervisorUp,
  staffOnly,
} = require('../../middlewares/roles.middleware');

const router = Router();

/**
 * @module ProductsRoutes
 * @description Define las rutas HTTP del módulo products.
 * Aplica autenticación global y control de acceso basado en roles (RBAC).
 *
 * Este módulo gestiona el acceso a productos e inventario,
 * incluyendo lectura, creación, actualización y eliminación lógica.
 *
 * Seguridad:
 * - Todas las rutas requieren autenticación JWT
 * - Lectura disponible para staff o superior
 * - Creación y actualización para supervisor o superior
 * - Eliminación restringida únicamente a administradores
 */

router.use(authenticate);

/**
 * GET /products
 * @description Lista productos con filtros, búsqueda y paginación
 * @access staff+
 */
router.get('/', staffOnly, controller.getAll);

/**
 * GET /products/:id
 * @description Obtiene un producto específico por ID
 * @access staff+
 */
router.get('/:id', staffOnly, controller.getById);

/**
 * POST /products
 * @description Crea un nuevo producto en el inventario
 * @access supervisor+
 */
router.post('/', supervisorUp, controller.create);

/**
 * PUT /products/:id
 * @description Actualiza información de un producto existente
 * @access supervisor+
 */
router.put('/:id', supervisorUp, controller.update);

/**
 * DELETE /products/:id
 * @description Elimina (soft delete) un producto del sistema
 * @access admin only
 */
router.delete('/:id', adminOnly, controller.remove);

module.exports = router;