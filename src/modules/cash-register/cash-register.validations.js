// src/modules/cash-register/cash-register.validations.js
import { z } from 'zod';

const msg = (campo) => ({
  required_error: `El campo ${campo} es requerido.`,
  invalid_type_error: `El campo ${campo} tiene un tipo de dato inválido.`,
});

// ──────────────────────────────────────────────
// POST /cash-register/open — Abrir caja
// ──────────────────────────────────────────────
export const abrirCajaSchema = z.object({
  montoInicial: z
    .number(msg('montoInicial'))
    .min(0, 'El monto inicial no puede ser negativo.')
    .max(99999999, 'El monto inicial parece demasiado alto.'),

  notas: z
    .string()
    .max(300, 'Las notas no pueden superar 300 caracteres.')
    .trim()
    .optional(),
});

// ──────────────────────────────────────────────
// POST /cash-register/close — Cerrar caja
// ──────────────────────────────────────────────
export const cerrarCajaSchema = z.object({
  // Conteo físico del efectivo que hay en la caja al cierre
  conteoFisicoEfectivo: z
    .number(msg('conteoFisicoEfectivo'))
    .min(0, 'El conteo físico no puede ser negativo.'),

  // Conteo de pagos recibidos por transferencia durante el día
  conteoTransferencias: z
    .number(msg('conteoTransferencias'))
    .min(0, 'El conteo de transferencias no puede ser negativo.')
    .default(0),

  notasCierre: z
    .string()
    .max(500, 'Las notas de cierre no pueden superar 500 caracteres.')
    .trim()
    .optional(),
});

// ──────────────────────────────────────────────
// GET /cash-register/history — Historial
// ──────────────────────────────────────────────
export const historialCajaSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  estado: z.enum(['ABIERTA', 'CERRADA']).optional(),
  desde: z.string().datetime({ message: 'Formato de fecha inválido.' }).optional(),
  hasta: z.string().datetime({ message: 'Formato de fecha inválido.' }).optional(),
});