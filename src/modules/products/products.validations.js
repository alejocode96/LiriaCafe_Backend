// src/modules/products/products.validations.js
//
// ¿Por qué validar insumosBase como array de objetos?
// La fórmula de consumo define exactamente qué insumos del inventario
// se descuentan al vender una unidad del producto. Es una relación 1:N
// (un producto tiene N insumos base). Validamos que cada elemento del
// array tenga los campos requeridos antes de llegar al servicio.
//
// ¿Por qué cantidad puede ser decimal?
// Un cappuccino usa 0.2 litros de leche (200ml). Los decimales son
// válidos porque la unidad de medida del inventario puede ser litros
// y la fórmula puede usar fracciones.

import { z } from 'zod';

const msg = (campo) => ({
  required_error: `El campo ${campo} es requerido.`,
  invalid_type_error: `El campo ${campo} tiene un tipo de dato inválido.`,
});

// Schema de un insumo dentro de la fórmula del producto
const insumoSchema = z.object({
  itemInventarioId: z
    .string(msg('itemInventarioId'))
    .min(1, 'El ID del ítem de inventario es requerido.'),

  cantidad: z
    .number(msg('cantidad'))
    .positive('La cantidad del insumo debe ser mayor a cero.')
    .max(99999, 'La cantidad parece demasiado alta. Verifica la unidad de medida.'),
});

// ──────────────────────────────────────────────
// POST /products — Crear producto
// ──────────────────────────────────────────────
export const crearProductoSchema = z.object({
  nombre: z
    .string(msg('nombre'))
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(100, 'El nombre no puede superar 100 caracteres.')
    .trim(),

  descripcion: z
    .string()
    .max(300, 'La descripción no puede superar 300 caracteres.')
    .trim()
    .optional(),

  categoriaId: z
    .string(msg('categoriaId'))
    .min(1, 'La categoría es requerida.'),

  precioBase: z
    .number(msg('precioBase'))
    .positive('El precio base debe ser mayor a cero.')
    .max(9999999, 'El precio parece demasiado alto.'),

  imagenUrl: z
    .string()
    .url('La URL de la imagen no es válida.')
    .optional(),

  tieneVariantes: z
    .boolean(msg('tieneVariantes'))
    .default(false),

  // Array de insumos base — puede estar vacío si el producto
  // no tiene fórmula definida aún (se agrega después)
  insumosBase: z
    .array(insumoSchema)
    .default([])
    .refine(
      (arr) => {
        // Verificar que no haya IDs de insumos duplicados en la fórmula
        const ids = arr.map((i) => i.itemInventarioId);
        return ids.length === new Set(ids).size;
      },
      { message: 'No puedes repetir el mismo insumo dos veces en la fórmula.' }
    ),
});

// ──────────────────────────────────────────────
// PUT /products/:id — Editar producto
// ──────────────────────────────────────────────
export const editarProductoSchema = z.object({
  nombre: z
    .string(msg('nombre'))
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(100, 'El nombre no puede superar 100 caracteres.')
    .trim()
    .optional(),

  descripcion: z
    .string()
    .max(300, 'La descripción no puede superar 300 caracteres.')
    .trim()
    .nullable()
    .optional(),

  categoriaId: z
    .string()
    .min(1, 'La categoría no puede estar vacía.')
    .optional(),

  precioBase: z
    .number(msg('precioBase'))
    .positive('El precio base debe ser mayor a cero.')
    .optional(),

  imagenUrl: z
    .string()
    .url('La URL de la imagen no es válida.')
    .nullable()
    .optional(),

  // Al editar, si se envían insumosBase se REEMPLAZA la fórmula completa
  insumosBase: z
    .array(insumoSchema)
    .optional()
    .refine(
      (arr) => {
        if (!arr) return true;
        const ids = arr.map((i) => i.itemInventarioId);
        return ids.length === new Set(ids).size;
      },
      { message: 'No puedes repetir el mismo insumo dos veces en la fórmula.' }
    ),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Debes enviar al menos un campo para actualizar.' }
);

// ──────────────────────────────────────────────
// GET /products — Query params para listar
// ──────────────────────────────────────────────
export const listarProductosSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  categoriaId: z.string().optional(),
  disponible: z.enum(['true', 'false']).optional(),
  buscar: z.string().optional(),
});

// ──────────────────────────────────────────────
// POST /products/:id/variants — Crear variante
// ──────────────────────────────────────────────
export const crearVarianteSchema = z.object({
  nombre: z
    .string(msg('nombre'))
    .min(2, 'El nombre de la variante debe tener al menos 2 caracteres.')
    .max(50, 'El nombre no puede superar 50 caracteres.')
    .trim(),

  // precioDiferencial: diferencia respecto al precioBase del producto
  // Puede ser positivo (variante más cara) o negativo (variante más barata)
  // Ejemplo: Jugo Grande = precioBase + 2000
  //          Jugo Pequeño = precioBase - 1000
  precioDiferencial: z
    .number(msg('precioDiferencial'))
    .default(0),

  // Insumos adicionales de la variante — SE SUMAN a los insumosBase del producto
  insumosAdicionales: z
    .array(insumoSchema)
    .default([])
    .refine(
      (arr) => {
        const ids = arr.map((i) => i.itemInventarioId);
        return ids.length === new Set(ids).size;
      },
      { message: 'No puedes repetir el mismo insumo dos veces.' }
    ),
});

// ──────────────────────────────────────────────
// PUT /products/:id/variants/:variantId — Editar variante
// ──────────────────────────────────────────────
export const editarVarianteSchema = z.object({
  nombre: z
    .string(msg('nombre'))
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(50, 'El nombre no puede superar 50 caracteres.')
    .trim()
    .optional(),

  precioDiferencial: z
    .number(msg('precioDiferencial'))
    .optional(),

  insumosAdicionales: z
    .array(insumoSchema)
    .optional()
    .refine(
      (arr) => {
        if (!arr) return true;
        const ids = arr.map((i) => i.itemInventarioId);
        return ids.length === new Set(ids).size;
      },
      { message: 'No puedes repetir el mismo insumo dos veces.' }
    ),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Debes enviar al menos un campo para actualizar.' }
);