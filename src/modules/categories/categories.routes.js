// src/modules/categories/categories.routes.js
//
// ¿Por qué router.use(authenticate) al inicio?
// En lugar de repetir el middleware en cada ruta, lo aplicamos
// globalmente al router. Express propaga el middleware a todas
// las rutas registradas después de ese use().

import { Router } from 'express';
import * as categoriesController from './categories.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import {
  crearCategoriaSchema,
  editarCategoriaSchema,
  listarCategoriasSchema,
} from './categories.validations.js';
import { MODULO, ACCION } from '../../config/constants.js';

const router = Router();
router.use(authenticate);

// POST /api/v1/categories
router.post(
  '/',
  authorize(MODULO.CATEGORIAS, ACCION.CREAR),
  validate(crearCategoriaSchema),
  categoriesController.crearCategoria
);

// GET /api/v1/categories
router.get(
  '/',
  authorize(MODULO.CATEGORIAS, ACCION.VER),
  validate(listarCategoriasSchema, 'query'),
  categoriesController.listarCategorias
);

// GET /api/v1/categories/:id
router.get(
  '/:id',
  authorize(MODULO.CATEGORIAS, ACCION.VER),
  categoriesController.verCategoria
);

// PUT /api/v1/categories/:id
router.put(
  '/:id',
  authorize(MODULO.CATEGORIAS, ACCION.EDITAR),
  validate(editarCategoriaSchema),
  categoriesController.editarCategoria
);

// PATCH /api/v1/categories/:id/deactivate
router.patch(
  '/:id/deactivate',
  authorize(MODULO.CATEGORIAS, ACCION.DESACTIVAR),
  categoriesController.desactivarCategoria
);

// AGREGAR en categories.routes.js
router.patch(
  '/:id/activate',
  authorize(MODULO.CATEGORIAS, ACCION.EDITAR),
  categoriesController.activarCategoria
);

export default router;