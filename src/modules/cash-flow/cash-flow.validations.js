// src/modules/cash-flow/cash-flow.validations.js
import { z } from 'zod';

const msg = (campo) => ({
  required_error: `El campo ${campo} es requerido.`,
  invalid_type_error: `El campo ${campo} tiene un tipo de dato inválido.`,
});

// ──────────────────────────────────────────────
// POST /cash-flow/categories — Crear categoría
// ──────────────────────────────────────────────
export const crearCategoriaMovSchema = z.object({
  nombre: z
    .string(msg('nombre'))
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(50, 'El nombre no puede superar 50 caracteres.')
    .trim(),

  descripcion: z
    .string()
    .max(200, 'La descripción no puede superar 200 caracteres.')
    .trim()
    .optional(),
});

// ──────────────────────────────────────────────
// GET /cash-flow/categories — Listar
// ──────────────────────────────────────────────
export const listarCategoriasMovSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
});

// ──────────────────────────────────────────────
// POST /cash-flow/movements — Registrar movimiento
// ──────────────────────────────────────────────
export const crearMovimientoSchema = z.object({

  tipo: z.enum(
    ['INGRESO', 'EGRESO', 'COMPRA_INVENTARIO'],
    { errorMap: () => ({ message: 'Tipo inválido. Use: INGRESO, EGRESO o COMPRA_INVENTARIO.' }) }
  ),

  monto: z
    .number(msg('monto'))
    .positive('El monto debe ser mayor a cero.')
    .max(999999999, 'El monto parece demasiado alto.'),

  concepto: z
    .string(msg('concepto'))
    .min(3, 'El concepto debe tener al menos 3 caracteres.')
    .max(200, 'El concepto no puede superar 200 caracteres.')
    .trim(),

  categoriaId: z
    .string(msg('categoriaId'))
    .min(1, 'La categoría es requerida.')
    .optional(),

  medioPago: z.enum(
    ['EFECTIVO', 'TRANSFERENCIA'],
    { errorMap: () => ({ message: 'Medio de pago inválido. Use: EFECTIVO o TRANSFERENCIA.' }) }
  ),

  // Si afectaCaja = true, el movimiento entra en el cuadre del cierre
  // Si afectaCaja = false, es solo registro contable (no afecta el efectivo del cajero)
  afectaCaja: z
    .boolean(msg('afectaCaja'))
    .default(true),

  notas: z
    .string()
    .max(500, 'Las notas no pueden superar 500 caracteres.')
    .trim()
    .optional(),

  // Para COMPRA_INVENTARIO: vincular con el ítem de inventario
  // El servicio creará automáticamente la entrada de inventario
  itemInventarioId: z
    .string()
    .optional(),

  cantidadInventario: z
    .number()
    .positive('La cantidad debe ser mayor a cero.')
    .optional(),
})
// Validación cruzada: COMPRA_INVENTARIO requiere itemInventarioId y cantidadInventario
.refine(
  (data) => {
    if (data.tipo === 'COMPRA_INVENTARIO') {
      return data.itemInventarioId && data.cantidadInventario;
    }
    return true;
  },
  {
    message: 'Para COMPRA_INVENTARIO debes especificar itemInventarioId y cantidadInventario.',
    path: ['itemInventarioId'],
  }
);

// ──────────────────────────────────────────────
// GET /cash-flow/movements — Listar movimientos
// ──────────────────────────────────────────────
export const listarMovimientosSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  tipo: z.enum(['INGRESO', 'EGRESO', 'COMPRA_INVENTARIO']).optional(),
  medioPago: z.enum(['EFECTIVO', 'TRANSFERENCIA']).optional(),
  categoriaId: z.string().optional(),
  cajaId: z.string().optional(),
  afectaCaja: z.enum(['true', 'false']).optional(),
  desde: z.string().datetime({ message: 'Formato de fecha inválido.' }).optional(),
  hasta: z.string().datetime({ message: 'Formato de fecha inválido.' }).optional(),
});

// ──────────────────────────────────────────────
// GET /cash-flow/summary — Resumen del período
// ──────────────────────────────────────────────
export const resumenSchema = z.object({
  desde: z.string().datetime({ message: 'Formato de fecha inválido.' }).optional(),
  hasta: z.string().datetime({ message: 'Formato de fecha inválido.' }).optional(),
  cajaId: z.string().optional(),
});