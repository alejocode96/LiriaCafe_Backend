// src/modules/users/users.routes.js
import { Router } from 'express';
import * as usersController from './users.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize, requireAdmin } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { MODULO, ACCION } from '../../config/constants.js';
import { crearUsuarioSchema,listarUsuariosSchema,editarUsuarioSchema } from './users.validations.js';



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





// AGREGAR ruta: EDITAR USUARIO
router.put(
  '/:id',
  authorize(MODULO.USUARIOS, ACCION.EDITAR),
  validate(editarUsuarioSchema),
  usersController.editarUsuario
);


// INACTIVAR
router.patch(
  '/:id/deactivate',
  authorize(MODULO.USUARIOS, ACCION.DESACTIVAR),
  usersController.desactivarUsuario
);

// ACTIVAR
router.patch(
  '/:id/reactivate',
  requireAdmin,
  usersController.reactivarUsuario
);

//desbloquear
router.patch(
  '/:id/unlock',
  requireAdmin,
  usersController.desbloquearCuenta
);

//cambio contraseña forzado
router.patch(
  '/:id/force-password-change',
  requireAdmin,
  usersController.forzarCambioContrasena
);

export default router;