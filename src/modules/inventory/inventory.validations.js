// src/modules/inventory/inventory.validations.js
import { z } from 'zod';

const msg = (campo) => ({
  required_error: `El campo ${campo} es requerido.`,
  invalid_type_error: `El campo ${campo} tiene un tipo de dato inválido.`,
});

// Unidades de medida válidas del sistema
const UNIDADES_MEDIDA = [
  'litro', 'mililitro', 'kilogramo', 'gramo',
  'libra', 'onza', 'unidad', 'porcion', 'caja', 'paquete',
];

// ──────────────────────────────────────────────
// POST /inventory/items — Crear ítem
// ──────────────────────────────────────────────
export const crearItemSchema = z.object({
  nombre: z
    .string(msg('nombre'))
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(100, 'El nombre no puede superar 100 caracteres.')
    .trim(),

  unidadMedida: z
    .string(msg('unidadMedida'))
    .refine(
      (val) => UNIDADES_MEDIDA.includes(val.toLowerCase()),
      `Unidad de medida inválida. Use: ${UNIDADES_MEDIDA.join(', ')}.`
    ),

  stockMinimo: z
    .number(msg('stockMinimo'))
    .min(0, 'El stock mínimo no puede ser negativo.')
    .default(0),

  proveedorHabitual: z
    .string()
    .max(100, 'El nombre del proveedor no puede superar 100 caracteres.')
    .trim()
    .optional(),

  descripcion: z
    .string()
    .max(200, 'La descripción no puede superar 200 caracteres.')
    .trim()
    .optional(),
});

// ──────────────────────────────────────────────
// PUT /inventory/items/:id — Editar ítem
// ──────────────────────────────────────────────
export const editarItemSchema = z.object({
  nombre: z
    .string(msg('nombre'))
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(100, 'El nombre no puede superar 100 caracteres.')
    .trim()
    .optional(),

  unidadMedida: z
    .string(msg('unidadMedida'))
    .refine(
      (val) => UNIDADES_MEDIDA.includes(val.toLowerCase()),
      `Unidad inválida. Use: ${UNIDADES_MEDIDA.join(', ')}.`
    )
    .optional(),

  stockMinimo: z
    .number(msg('stockMinimo'))
    .min(0, 'El stock mínimo no puede ser negativo.')
    .optional(),

  proveedorHabitual: z
    .string()
    .max(100)
    .trim()
    .optional(),

  descripcion: z
    .string()
    .max(200)
    .trim()
    .optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Debes enviar al menos un campo para actualizar.' }
);

// ──────────────────────────────────────────────
// POST /inventory/items/:id/entries — Registrar entrada
// ──────────────────────────────────────────────
export const crearEntradaSchema = z.object({
  cantidad: z
    .number(msg('cantidad'))
    .positive('La cantidad debe ser mayor a cero.'),

  precioUnitario: z
    .number(msg('precioUnitario'))
    .positive('El precio unitario debe ser mayor a cero.'),

  proveedor: z
    .string()
    .max(100, 'El nombre del proveedor no puede superar 100 caracteres.')
    .trim()
    .optional(),

  facturaRef: z
    .string()
    .max(50, 'La referencia de factura no puede superar 50 caracteres.')
    .trim()
    .optional(),

  notas: z
    .string()
    .max(300, 'Las notas no pueden superar 300 caracteres.')
    .trim()
    .optional(),

  // Fecha de la entrada — por defecto la fecha actual
  fecha: z
    .string()
    .datetime({ message: 'Formato de fecha inválido. Use ISO 8601.' })
    .optional(),
});

// ──────────────────────────────────────────────
// GET /inventory/items — Query params
// ──────────────────────────────────────────────
export const listarItemsSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  buscar: z.string().optional(),
  // Filtro especial: solo ítems bajo el stock mínimo
  bajoStock: z.enum(['true', 'false']).optional(),
});