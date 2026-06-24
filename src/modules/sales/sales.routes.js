// src/modules/sales/sales.routes.js
import { Router } from 'express';
import * as salesController from './sales.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import {
  crearVentaSchema,
  anularVentaSchema,
  listarVentasSchema,
} from './sales.validations.js';
import { MODULO, ACCION } from '../../config/constants.js';

const router = Router();
router.use(authenticate);

// POST /api/v1/sales — Crear venta
router.post(
  '/',
  authorize(MODULO.VENTAS, ACCION.CREAR),
  validate(crearVentaSchema),
  salesController.crearVenta
);

// GET /api/v1/sales — Listar ventas
router.get(
  '/',
  authorize(MODULO.VENTAS, ACCION.VER),
  validate(listarVentasSchema, 'query'),
  salesController.listarVentas
);

// GET /api/v1/sales/:id — Ver venta (por ID o número)
router.get(
  '/:id',
  authorize(MODULO.VENTAS, ACCION.VER),
  salesController.verVenta
);

// POST /api/v1/sales/:id/cancel — Anular venta
router.post(
  '/:id/cancel',
  authorize(MODULO.VENTAS, ACCION.EDITAR),
  validate(anularVentaSchema),
  salesController.anularVenta
);

export default router;