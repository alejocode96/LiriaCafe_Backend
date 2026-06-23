// src/modules/categories/categories.validations.js
//
// ¿Por qué validar el orden como número entero positivo?
// El orden controla la posición en la pantalla POS.
// Un orden negativo o decimal no tiene sentido semántico.
// Un orden de 0 es válido (primera posición).

import { z } from 'zod';

const msg = (campo) => ({
  required_error: `El campo ${campo} es requerido.`,
  invalid_type_error: `El campo ${campo} tiene un tipo de dato inválido.`,
});

// ──────────────────────────────────────────────
// POST /categories — Crear categoría
// ──────────────────────────────────────────────
export const crearCategoriaSchema = z.object({
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

  // imagenUrl: en esta versión se guarda la URL de una imagen ya subida.
  // En el futuro, se puede agregar un endpoint de upload con multer.
  imagenUrl: z
    .string()
    .url('La URL de la imagen no es válida.')
    .optional(),

  // orden: si no se envía, el servicio calculará el siguiente disponible
  orden: z
    .number(msg('orden'))
    .int('El orden debe ser un número entero.')
    .min(0, 'El orden no puede ser negativo.')
    .optional(),
});

// ──────────────────────────────────────────────
// PUT /categories/:id — Editar categoría
// ──────────────────────────────────────────────
export const editarCategoriaSchema = z.object({
  nombre: z
    .string(msg('nombre'))
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(50, 'El nombre no puede superar 50 caracteres.')
    .trim()
    .optional(),

  descripcion: z
    .string()
    .max(200, 'La descripción no puede superar 200 caracteres.')
    .trim()
    .optional(),

  imagenUrl: z
    .string()
    .url('La URL de la imagen no es válida.')
    .nullable()   // Permite enviar null para eliminar la imagen
    .optional(),

  orden: z
    .number(msg('orden'))
    .int('El orden debe ser un número entero.')
    .min(0, 'El orden no puede ser negativo.')
    .optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Debes enviar al menos un campo para actualizar.' }
);

// ──────────────────────────────────────────────
// GET /categories — Query params para listar
// ──────────────────────────────────────────────
export const listarCategoriasSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  buscar: z.string().optional(),
});