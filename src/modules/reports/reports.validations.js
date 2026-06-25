// src/modules/reports/reports.validations.js
//
// Los schemas de reportes son principalmente filtros de fecha.
// La mayoría de los parámetros son opcionales — si no se especifican,
// el sistema toma los últimos 30 días por defecto.

import { z } from 'zod';

// Schema base reutilizable para filtros de fecha y paginación
const baseReportSchema = z.object({
  desde: z
    .string()
    .datetime({ message: 'Formato de fecha inválido. Use ISO 8601. Ej: 2024-01-15T00:00:00.000Z' })
    .optional(),
  hasta: z
    .string()
    .datetime({ message: 'Formato de fecha inválido.' })
    .optional(),
});

// ──────────────────────────────────────────────
// GET /reports/sales
// ──────────────────────────────────────────────
export const reporteVentasSchema = baseReportSchema.extend({
  cajeroId: z.string().optional(),
  cajaId: z.string().optional(),
  categoriaId: z.string().optional(),
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'COMBINADO']).optional(),
  incluirAnuladas: z.enum(['true', 'false']).optional().default('false'),
  topProductos: z.string().optional().default('10'),
});

// ──────────────────────────────────────────────
// GET /reports/profitability
// ──────────────────────────────────────────────
export const reporteRentabilidadSchema = baseReportSchema.extend({
  categoriaId: z.string().optional(),
  productoId: z.string().optional(),
  limite: z.string().optional().default('20'),
});

// ──────────────────────────────────────────────
// GET /reports/inventory
// ──────────────────────────────────────────────
export const reporteInventarioSchema = z.object({
  soloAlertas: z.enum(['true', 'false']).optional().default('false'),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional().default('ACTIVO'),
});

// ──────────────────────────────────────────────
// GET /reports/cash
// ──────────────────────────────────────────────
export const reporteCajaSchema = baseReportSchema.extend({
  cajaId: z.string().optional(),
});

// ──────────────────────────────────────────────
// GET /reports/dashboard
// ──────────────────────────────────────────────
export const dashboardSchema = baseReportSchema;