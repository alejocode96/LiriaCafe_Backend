// src/modules/products/products.routes.js
//
// DISEÑO DE URLs:
// Los recursos anidados siguen la convención REST:
//   /products/:id/variants         → variantes de un producto
//   /products/:id/variants/:variantId → variante específica
//
// ¿Por qué /:id/variants y no /variants/:variantId?
// Porque una variante no existe sin su producto padre.
// La URL refleja esta dependencia jerárquica.
// Además, permite validar que la variante pertenece al producto
// correcto usando ambos IDs juntos.

import { Router } from 'express';
import * as productsController from './products.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import {
  crearProductoSchema,
  editarProductoSchema,
  listarProductosSchema,
  crearVarianteSchema,
  editarVarianteSchema,
} from './products.validations.js';
import { MODULO, ACCION } from '../../config/constants.js';

const router = Router();
router.use(authenticate);

// ── PRODUCTOS ────────────────────────────────

// POST /api/v1/products
router.post(
  '/',
  authorize(MODULO.PRODUCTOS, ACCION.CREAR),
  validate(crearProductoSchema),
  productsController.crearProducto
);

// GET /api/v1/products
router.get(
  '/',
  authorize(MODULO.PRODUCTOS, ACCION.VER),
  validate(listarProductosSchema, 'query'),
  productsController.listarProductos
);

// GET /api/v1/products/:id
router.get(
  '/:id',
  authorize(MODULO.PRODUCTOS, ACCION.VER),
  productsController.verProducto
);

// PUT /api/v1/products/:id
router.put(
  '/:id',
  authorize(MODULO.PRODUCTOS, ACCION.EDITAR),
  validate(editarProductoSchema),
  productsController.editarProducto
);

// PATCH /api/v1/products/:id/deactivate
router.patch(
  '/:id/deactivate',
  authorize(MODULO.PRODUCTOS, ACCION.DESACTIVAR),
  productsController.desactivarProducto
);

// PATCH /api/v1/products/:id/activate
router.patch(
  '/:id/activate',
  authorize(MODULO.PRODUCTOS, ACCION.EDITAR),
  productsController.activarProducto
);

// ── VARIANTES ────────────────────────────────

// POST /api/v1/products/:id/variants
router.post(
  '/:id/variants',
  authorize(MODULO.PRODUCTOS, ACCION.CREAR),
  validate(crearVarianteSchema),
  productsController.crearVariante
);

// PUT /api/v1/products/:id/variants/:variantId
router.put(
  '/:id/variants/:variantId',
  authorize(MODULO.PRODUCTOS, ACCION.EDITAR),
  validate(editarVarianteSchema),
  productsController.editarVariante
);

// PATCH /api/v1/products/:id/variants/:variantId/deactivate
router.patch(
  '/:id/variants/:variantId/deactivate',
  authorize(MODULO.PRODUCTOS, ACCION.DESACTIVAR),
  productsController.desactivarVariante
);

// PATCH /api/v1/products/:id/variants/:variantId/activate
router.patch(
  '/:id/variants/:variantId/activate',
  authorize(MODULO.PRODUCTOS, ACCION.EDITAR),
  productsController.activarVariante
);

export default router;