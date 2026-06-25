// src/modules/reports/reports.routes.js
//
// Los reportes usan el permiso ACCION.REPORTES.
// Solo usuarios con ese permiso habilitado en su rol pueden verlos.
// El administrador siempre puede ver todos los reportes.

import { Router } from 'express';
import * as reportsController from './reports.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import {
  reporteVentasSchema,
  reporteRentabilidadSchema,
  reporteInventarioSchema,
  reporteCajaSchema,
  dashboardSchema,
} from './reports.validations.js';
import { MODULO, ACCION } from '../../config/constants.js';

const router = Router();
router.use(authenticate);

// GET /api/v1/reports/dashboard — Resumen ejecutivo
router.get(
  '/dashboard',
  authorize(MODULO.REPORTES, ACCION.VER),
  validate(dashboardSchema, 'query'),
  reportsController.dashboard
);

// GET /api/v1/reports/sales — Reporte de ventas
router.get(
  '/sales',
  authorize(MODULO.REPORTES, ACCION.REPORTES),
  validate(reporteVentasSchema, 'query'),
  reportsController.reporteVentas
);

// GET /api/v1/reports/profitability — Reporte de rentabilidad
router.get(
  '/profitability',
  authorize(MODULO.REPORTES, ACCION.REPORTES),
  validate(reporteRentabilidadSchema, 'query'),
  reportsController.reporteRentabilidad
);

// GET /api/v1/reports/inventory — Reporte de inventario
router.get(
  '/inventory',
  authorize(MODULO.INVENTARIO, ACCION.REPORTES),
  validate(reporteInventarioSchema, 'query'),
  reportsController.reporteInventario
);

// GET /api/v1/reports/cash — Reporte de caja y flujo
router.get(
  '/cash',
  authorize(MODULO.CAJA, ACCION.REPORTES),
  validate(reporteCajaSchema, 'query'),
  reportsController.reporteCaja
);

export default router;