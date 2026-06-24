// src/modules/sales/sales.validations.js
//
// ¿Por qué el schema de venta es más complejo que los anteriores?
// Porque una venta tiene múltiples capas de validación:
// 1. Validación de estructura (Zod) — ¿los campos tienen el tipo correcto?
// 2. Validación de negocio (servicio) — ¿el producto existe? ¿hay stock?
// 3. Validación de consistencia (servicio) — ¿el monto en efectivo es suficiente?
//
// Zod solo hace la capa 1. Las capas 2 y 3 están en el servicio.

import { z } from 'zod';

const msg = (campo) => ({
  required_error: `El campo ${campo} es requerido.`,
  invalid_type_error: `El campo ${campo} tiene un tipo de dato inválido.`,
});

// Schema de un ítem individual del carrito
const itemVentaSchema = z.object({
  productoId: z
    .string(msg('productoId'))
    .min(1, 'El ID del producto es requerido.'),

  // varianteId es opcional — solo si el producto tiene variantes
  varianteId: z
    .string()
    .min(1, 'El ID de variante no puede estar vacío.')
    .optional(),

  cantidad: z
    .number(msg('cantidad'))
    .int('La cantidad debe ser un número entero.')
    .positive('La cantidad debe ser mayor a cero.')
    .max(999, 'La cantidad máxima por ítem es 999.'),

  // Descuento aplicado a este ítem específico (en pesos, no porcentaje)
  descuento: z
    .number(msg('descuento'))
    .min(0, 'El descuento no puede ser negativo.')
    .default(0),
});

// ──────────────────────────────────────────────
// POST /sales — Crear venta
// ──────────────────────────────────────────────
export const crearVentaSchema = z.object({
  // El carrito debe tener al menos un ítem
  items: z
    .array(itemVentaSchema)
    .min(1, 'La venta debe tener al menos un producto.')
    .max(50, 'Una venta no puede tener más de 50 ítems diferentes.'),

  // Descuento aplicado al total de la factura (en pesos)
  descuentoTotal: z
    .number(msg('descuentoTotal'))
    .min(0, 'El descuento total no puede ser negativo.')
    .default(0),

  // Método de pago — solo efectivo y transferencia según el documento
  metodoPago: z.enum(
    ['EFECTIVO', 'TRANSFERENCIA', 'COMBINADO'],
    { errorMap: () => ({ message: 'Método de pago inválido. Use: EFECTIVO, TRANSFERENCIA o COMBINADO.' }) }
  ),

  // Monto pagado en efectivo (requerido si metodoPago es EFECTIVO o COMBINADO)
  montoEfectivo: z
    .number(msg('montoEfectivo'))
    .min(0, 'El monto en efectivo no puede ser negativo.')
    .optional(),

  // Monto pagado por transferencia
  montoTransferencia: z
    .number(msg('montoTransferencia'))
    .min(0, 'El monto de transferencia no puede ser negativo.')
    .optional(),

  // Datos del cliente (opcionales, para facturación formal)
  clienteNombre: z
    .string()
    .max(100, 'El nombre del cliente no puede superar 100 caracteres.')
    .trim()
    .optional(),

  clienteNit: z
    .string()
    .max(20, 'El NIT/cédula no puede superar 20 caracteres.')
    .trim()
    .optional(),
})
// Validaciones cruzadas entre campos
.refine(
  // Si el método es EFECTIVO, montoEfectivo es requerido
  (data) => {
    if (data.metodoPago === 'EFECTIVO') return data.montoEfectivo !== undefined;
    return true;
  },
  { message: 'El monto en efectivo es requerido cuando el método de pago es EFECTIVO.', path: ['montoEfectivo'] }
)
.refine(
  // Si el método es TRANSFERENCIA, montoTransferencia es requerido
  (data) => {
    if (data.metodoPago === 'TRANSFERENCIA') return data.montoTransferencia !== undefined;
    return true;
  },
  { message: 'El monto de transferencia es requerido cuando el método es TRANSFERENCIA.', path: ['montoTransferencia'] }
)
.refine(
  // Si el método es COMBINADO, ambos montos son requeridos
  (data) => {
    if (data.metodoPago === 'COMBINADO') {
      return data.montoEfectivo !== undefined && data.montoTransferencia !== undefined;
    }
    return true;
  },
  { message: 'Para pago COMBINADO se requieren montoEfectivo y montoTransferencia.', path: ['metodoPago'] }
);

// ──────────────────────────────────────────────
// POST /sales/:id/cancel — Anular venta
// ──────────────────────────────────────────────
export const anularVentaSchema = z.object({
  motivoAnulacion: z
    .string(msg('motivoAnulacion'))
    .min(10, 'El motivo de anulación debe tener al menos 10 caracteres.')
    .max(500, 'El motivo no puede superar 500 caracteres.')
    .trim(),
});

// ──────────────────────────────────────────────
// GET /sales — Query params para listar
// ──────────────────────────────────────────────
export const listarVentasSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  estado: z.enum(['COMPLETADA', 'ANULADA']).optional(),
  cajaId: z.string().optional(),
  cajeroId: z.string().optional(),
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'COMBINADO']).optional(),
  desde: z.string().datetime({ message: 'Formato de fecha inválido. Use ISO 8601.' }).optional(),
  hasta: z.string().datetime({ message: 'Formato de fecha inválido. Use ISO 8601.' }).optional(),
  numero: z.string().optional(), // Búsqueda por número de factura
});