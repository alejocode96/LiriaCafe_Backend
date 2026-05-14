// backend/src/modules/roles/routes.js

const { Router } = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const db = require('../../config/db');
const { list } = require('../../utils/response');

const router = Router();

/**
 * @module RolesRoutes
 * @description Endpoint de lectura para roles del sistema.
 * Permite obtener la lista de roles disponibles para asignación
 * y control de acceso (RBAC).
 *
 * Este endpoint es de solo lectura y está protegido por autenticación JWT.
 *
 * Nota:
 * Actualmente los roles se obtienen directamente desde base de datos
 * sin capa de service/repository debido a su simplicidad.
 */

/**
 * GET /roles
 * @description Retorna todos los roles disponibles en el sistema
 * @access Private (authenticated users only)
 *
 * @returns {Array<Object>} Lista de roles ordenados por ID
 */
router.get('/', authenticate, (req, res) => {
  const roles = db.prepare(`
    SELECT id, name, description
    FROM roles
    ORDER BY id
  `).all();

  return list(res, roles);
});

module.exports = router;