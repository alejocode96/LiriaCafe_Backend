// backend/src/modules/users/routes.js

const { Router } = require('express');
const controller = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { adminOnly, supervisorUp } = require('../../middlewares/roles.middleware');

const router = Router();

/**
 * @module UsersRoutes
 * @description Define las rutas HTTP del módulo users.
 * Aplica autenticación global y control de acceso basado en roles (RBAC).
 *
 * Seguridad:
 * - Todas las rutas requieren autenticación JWT
 * - Lectura disponible para supervisor o superior
 * - Escritura restringida únicamente a administradores
 */

/**
 * Middleware global de autenticación
 * Todas las rutas definidas en este módulo requieren usuario autenticado.
 */
router.use(authenticate);

/**
 * GET /users
 * @description Lista usuarios con filtros y paginación
 * @access supervisor+
 */
router.get('/', supervisorUp, controller.getAll);

/**
 * GET /users/:id
 * @description Obtiene detalle de un usuario
 * @access supervisor+
 */
router.get('/:id', supervisorUp, controller.getById);

/**
 * POST /users
 * @description Crea un nuevo usuario en el sistema
 * @access admin only
 */
router.post('/', adminOnly, controller.create);

/**
 * PUT /users/:id
 * @description Actualiza información de un usuario existente
 * @access admin only
 */
router.put('/:id', adminOnly, controller.update);

/**
 * DELETE /users/:id
 * @description Elimina (soft delete) un usuario del sistema
 * @access admin only
 */
router.delete('/:id', adminOnly, controller.remove);

module.exports = router;