import {z} from 'zod';
import { MODULOS_DISPONIBLES, ACCIONES_DISPONIBLES } from '../../config/constants';

//Schema de un permiso individual dentro de la matriz
//Ejemplo: {modulo: "VENTAS" , accion: "CREAR", permitido: true}
const permisoSchema = z.object({
    modulo: z.enum(MODULOS_DISPONIBLES,{
        errorMap: () => ({message: `Módulo inválido. valores permitos: ${MODULOS_DISPONIBLES.join(', ')}`}),
    }),
    accion: z.enum(ACCIONES_DISPONIBLES,{
        errorMap: ()=> ({message: `Acción inválida. Valores permitidos: ${ACCIONES_DISPONIBLES.join(', ')}`}),
    }),
    permitido: z.boolean(
        {
            required_error: 'El campo permitido es requerido (true o false).',
        }
    ),
});

// ──────────────────────────────────────────────
// POST /roles — Crear rol
// ──────────────────────────────────────────────
export const crearRolSchema = z.object({
    nombre: z
        .string({required_error: 'El nombre del rol es requerido.'})
        .min(3,'El nombre debe tener al menos 3 caracteres.')
        .max(50, 'El nombre no puede superar 50 caracteres.')
        .trim()
        .toUpperCase(),

    descripcion: z
        .string()
        .max(200, 'La descripción no puede superar 200 caracteres.')
        .trim()
        .optional(),

    // La matriz de permisos es opcional al crear
    // Si no se envia, el sistema inicializa todos en false
    permisos: z
        .array(permisoSchema)
        .optional()
        .default([]),
});

// ──────────────────────────────────────────────
// PUT /roles/:id — Editar rol
// ──────────────────────────────────────────────
export const editarRolSchema = z.object({
    nombre: z
        .string()
        .min(3, 'El nombre debe tener al menos 3 caracteres.')
        .max(50, 'El nombre no puede superar 50 caracteres.')
        .trim()
        .toUpperCase()
        .optional(),

    descripcion: z
        .string()
        .max(200, 'La descripción no puede superar 200 caracteres.')  
        .trim()
        .optional(),
        
    permisos: z
        .array(permisoSchema)
        .optional(),
});

// ──────────────────────────────────────────────
// GET /roles — Query params para filtrar y paginar
// ──────────────────────────────────────────────
export const listarRolesSchema = z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional.default('20'),
    estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
    nombre: z.string().optional(),
});