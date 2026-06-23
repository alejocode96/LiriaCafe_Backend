// src/modules/users/users.routes.js
import { Router } from 'express';
import * as usersController from './users.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize, requireAdmin } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { MODULO, ACCION } from '../../config/constants.js';
import { crearUsuarioSchema,listarUsuariosSchema } from './users.validations.js';



const router = Router();
router.use(authenticate); // Todos los endpoints requieren autenticación

// ──────────────────────────────────────────────
// POST /api/v1/users — Crear usuario
// Solo el Administrador puede crear usuarios
// ──────────────────────────────────────────────
router.post(
'/',
requireAdmin,  //Solo admin
validate(crearUsuarioSchema), //Validar body
usersController.crearUusario
);

// GET /api/v1/users — Listar usuarios
router.get(
  '/',
  authorize(MODULO.USUARIOS, ACCION.VER),
  validate(listarUsuariosSchema, 'query'),
  usersController.listarUsuarios
);

//OBTENER USUARIO POR ID
router.get(
  '/:id',
  authorize(MODULO.USUARIOS, ACCION.VER),
  usersController.verUsuario
);

export default router;