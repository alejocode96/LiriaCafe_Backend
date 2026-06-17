// src/modules/roles/roles.routes.js
//
// Define las URLs y el orden de middlewares para cada endpoint.
// Orden obligatorio: authenticate → authorize → validate → controller
import { Router } from 'express';
import * as rolesController from './roles.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize, requireAdmin } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import {
  crearRolSchema,
  editarRolSchema,
  listarRolesSchema,
} from './roles.validations.js';
import { MODULO, ACCION } from '../../config/constants.js';

const router = Router();

// Todos los endpoints de roles requieren autenticación
// En lugar de repetir `authenticate` en cada ruta, lo aplicamos globalmente al router
router.use(authenticate);

// ──────────────────────────────────────────────
// POST /api/v1/roles — Crear rol
// Solo el Administrador puede crear roles
// ──────────────────────────────────────────────
router.post(
    '/',
    requireAdmin, // solo admin
    validate(crearRolSchema),
    rolesController.crearRol
);

// ──────────────────────────────────────────────
// GET /api/v1/roles — Listar roles
// ──────────────────────────────────────────────
router.get(
    '/',
    authorize(MODULO.ROLES, ACCION.VER),
    validate(listarRolesSchema, 'query'), // validar query params
    rolesController.listarRoles
);

// ──────────────────────────────────────────────
// GET /api/v1/roles/:id — Ver rol por ID
// ──────────────────────────────────────────────
router.get(
    '/:id',
    authorize(MODULO.ROLES, ACCION.VER),
    rolesController.verRol
);

// ──────────────────────────────────────────────
// PUT /api/v1/roles/:id — Editar rol
// ──────────────────────────────────────────────
router.put(
    '/:id',
    authorize(MODULO.ROLES, ACCION.EDITAR),
    validate(editarRolSchema),
    rolesController.editarRol
);

// ──────────────────────────────────────────────
// PATCH /api/v1/roles/:id/deactivate — Desactivar rol
// ──────────────────────────────────────────────
router.patch(
    '/:id/deactivate',
    authorize(MODULO.ROLES, ACCION.DESACTIVAR),
    rolesController.desactivarRol
);

// ──────────────────────────────────────────────
// GET /api/v1/roles/:id/users — Ver usuarios del rol
// ──────────────────────────────────────────────
router.get(
    '/:id/users',
    authorize(MODULO.ROLES, ACCION.VER),
    rolesController.verUsuariosPorRol
);

export default router;