// src/modules/cash-flow/cash-flow.routes.js
//
// ORDEN DE RUTAS — igual que en caja:
// Las rutas estáticas (/categories, /movements, /summary)
// van ANTES de las dinámicas (/:id).

import { Router } from 'express';
import * as cashFlowController from './cash-flow.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import {
  crearCategoriaMovSchema,
  listarCategoriasMovSchema,
  crearMovimientoSchema,
  listarMovimientosSchema,
  resumenSchema,
} from './cash-flow.validations.js';
import { MODULO, ACCION } from '../../config/constants.js';

const router = Router();
router.use(authenticate);

// ── CATEGORÍAS DE MOVIMIENTO ─────────────────

// POST /api/v1/cash-flow/categories
router.post(
  '/categories',
  authorize(MODULO.FLUJO_CAJA, ACCION.CREAR),
  validate(crearCategoriaMovSchema),
  cashFlowController.crearCategoriaMov
);

// GET /api/v1/cash-flow/categories
router.get(
  '/categories',
  authorize(MODULO.FLUJO_CAJA, ACCION.VER),
  validate(listarCategoriasMovSchema, 'query'),
  cashFlowController.listarCategoriasMov
);

// PATCH /api/v1/cash-flow/categories/:id/deactivate
router.patch(
  '/categories/:id/deactivate',
  authorize(MODULO.FLUJO_CAJA, ACCION.DESACTIVAR),
  cashFlowController.desactivarCategoriaMov
);

// PATCH /api/v1/cash-flow/categories/:id/activate
router.patch(
  '/categories/:id/activate',
  authorize(MODULO.FLUJO_CAJA, ACCION.EDITAR),
  cashFlowController.activarCategoriaMov
);

// ── MOVIMIENTOS ───────────────────────────────

// GET /api/v1/cash-flow/summary — Va ANTES de /movements/:id
router.get(
  '/summary',
  authorize(MODULO.FLUJO_CAJA, ACCION.REPORTES),
  validate(resumenSchema, 'query'),
  cashFlowController.resumenFinanciero
);

// POST /api/v1/cash-flow/movements
router.post(
  '/movements',
  authorize(MODULO.FLUJO_CAJA, ACCION.CREAR),
  validate(crearMovimientoSchema),
  cashFlowController.registrarMovimiento
);

// GET /api/v1/cash-flow/movements
router.get(
  '/movements',
  authorize(MODULO.FLUJO_CAJA, ACCION.VER),
  validate(listarMovimientosSchema, 'query'),
  cashFlowController.listarMovimientos
);

// GET /api/v1/cash-flow/movements/:id
router.get(
  '/movements/:id',
  authorize(MODULO.FLUJO_CAJA, ACCION.VER),
  cashFlowController.verMovimiento
);

export default router;