// src/modules/inventory/inventory.routes.js
//
// ¿Por qué los endpoints de entrada y kardex usan /:id/entries y /:id/kardex?
// Porque son sub-recursos del ítem. REST recomienda esta estructura:
//   /inventory/items/:id/entries  → entradas de un ítem específico
//   /inventory/items/:id/kardex   → movimientos de un ítem específico
// Es más semántico que tener endpoints separados sin contexto del padre.

import { Router } from 'express';
import * as inventoryController from './inventory.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import {
  crearItemSchema,
  editarItemSchema,
  listarItemsSchema,
  crearEntradaSchema,
} from './inventory.validations.js';
import { MODULO, ACCION } from '../../config/constants.js';

const router = Router();
router.use(authenticate);

// ── ÍTEMS ────────────────────────────────────

// POST /api/v1/inventory/items
router.post(
  '/items',
  authorize(MODULO.INVENTARIO, ACCION.CREAR),
  validate(crearItemSchema),
  inventoryController.crearItem
);

// GET /api/v1/inventory/items
router.get(
  '/items',
  authorize(MODULO.INVENTARIO, ACCION.VER),
  validate(listarItemsSchema, 'query'),
  inventoryController.listarItems
);

// GET /api/v1/inventory/items/:id
router.get(
  '/items/:id',
  authorize(MODULO.INVENTARIO, ACCION.VER),
  inventoryController.verItem
);

// PUT /api/v1/inventory/items/:id
router.put(
  '/items/:id',
  authorize(MODULO.INVENTARIO, ACCION.EDITAR),
  validate(editarItemSchema),
  inventoryController.editarItem
);

// PATCH /api/v1/inventory/items/:id/deactivate
router.patch(
  '/items/:id/deactivate',
  authorize(MODULO.INVENTARIO, ACCION.DESACTIVAR),
  inventoryController.desactivarItem
);

// ── ENTRADAS DE INVENTARIO ────────────────────

// POST /api/v1/inventory/items/:id/entries
router.post(
  '/items/:id/entries',
  authorize(MODULO.INVENTARIO, ACCION.CREAR),
  validate(crearEntradaSchema),
  inventoryController.registrarEntrada
);

// ── KARDEX ────────────────────────────────────

// GET /api/v1/inventory/items/:id/kardex
router.get(
  '/items/:id/kardex',
  authorize(MODULO.INVENTARIO, ACCION.VER),
  inventoryController.verKardex
);

// AGREGAR en inventory.routes.js después del deactivate:
router.patch(
  '/items/:id/activate',
  authorize(MODULO.INVENTARIO, ACCION.EDITAR),
  inventoryController.activarItem
);


export default router;