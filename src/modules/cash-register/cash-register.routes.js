// src/modules/cash-register/cash-register.routes.js
//
// ORDEN CRÍTICO DE LAS RUTAS:
// Express resuelve rutas en el orden en que se registran.
// Las rutas específicas (/current, /status, /history, /open, /close)
// DEBEN ir ANTES de la ruta genérica (/:id).
//
// Si /:id va primero, Express interpretaría /current como un ID
// y fallaría porque no encuentra ninguna caja con ID "current".
//
// REGLA: Las rutas estáticas siempre antes que las dinámicas.

import { Router } from 'express';
import * as cashRegisterController from './cash-register.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import {
  abrirCajaSchema,
  cerrarCajaSchema,
  historialCajaSchema,
} from './cash-register.validations.js';
import { MODULO, ACCION } from '../../config/constants.js';

const router = Router();
router.use(authenticate);

// ──────────────────────────────────────────────
// RUTAS ESTÁTICAS (van ANTES de /:id)
// ──────────────────────────────────────────────

// POST /api/v1/cash-register/open — Abrir caja
router.post(
  '/open',
  authorize(MODULO.CAJA, ACCION.CREAR),
  validate(abrirCajaSchema),
  cashRegisterController.abrirCaja
);

// GET /api/v1/cash-register/current — Caja activa con resumen financiero
router.get(
  '/current',
  authorize(MODULO.CAJA, ACCION.VER),
  cashRegisterController.verCajaActual
);

// GET /api/v1/cash-register/status — Estado simplificado
// Este endpoint es más permisivo — lo usan otros módulos internamente
router.get(
  '/status',
  authorize(MODULO.CAJA, ACCION.VER),
  cashRegisterController.estadoCaja
);

// POST /api/v1/cash-register/close — Cerrar caja activa
router.post(
  '/close',
  authorize(MODULO.CAJA, ACCION.CREAR),
  validate(cerrarCajaSchema),
  cashRegisterController.cerrarCaja
);

// GET /api/v1/cash-register/history — Historial de todas las cajas
router.get(
  '/history',
  authorize(MODULO.CAJA, ACCION.REPORTES),
  validate(historialCajaSchema, 'query'),
  cashRegisterController.historialCajas
);

// ──────────────────────────────────────────────
// RUTAS DINÁMICAS (van DESPUÉS de las estáticas)
// ──────────────────────────────────────────────

// GET /api/v1/cash-register/:id — Ver caja específica por ID
router.get(
  '/:id',
  authorize(MODULO.CAJA, ACCION.VER),
  cashRegisterController.verCaja
);

export default router;