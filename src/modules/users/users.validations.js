// src/modules/users/users.validations.js
import { z } from 'zod';
import { required } from 'zod/mini';

// Helper de mensajes en español - mismo patrón que auth.validations.
const msg= (campo)=>({
    required_error: `El campo ${campo} es requerido.`,
    invalid_type_error: `El campo ${campo} tiene un tipo de dato inválido.`,
});

// ──────────────────────────────────────────────
// POST /users — Crear usuario
// ──────────────────────────────────────────────
export const crearUsuarioSchema = z.object({
    nombreCompleto: z
        .string(msg('nombreCompleto'))
        .min(3, 'El nombre completo debe tener al menos 3 caracteres.')
        .max(100, 'El nombre completo no puede superar 100 caracteres.')
        .trim(),

    nombreUsuario: z
        .string(msg('nombreUsuario'))
        .min(3, 'El nombre de usuario debe tener al menos 3 caracteres.')
        .max(30, 'El nombre de usuario no puede superar 30 caracteres.')
        .regex(
            /^[a-zA-Z0-9_]+$/,
            'El nombre de usuario solo puede contener letras, números y guiones bajos.'
        )
        .trim()
        .toLowerCase(),

    correo: z
        .string(msg('correo'))
        .min(1, 'El correo electrónico es requerido.')
        .email('El formato del correo electrónico no es valido.')
        .trim()
        .toLowerCase(),

    contrasena: z
        .string(msg('Contrasena'))
        .min(8, 'La contraseña temporal debe tener al menos 8 caracteres.')
        .max(100, 'La contraseña no puede superar 100 caracteres.'),
    
    rolId: z
        .string(msg('rolId'))
        .min(1, 'El ID del rol es requerido.')
        .trim(),
    

    
});

// ──────────────────────────────────────────────
// GET /users — Query params para listar
// ──────────────────────────────────────────────
export const listarUsuariosSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  estado: z.enum(['ACTIVO', 'INACTIVO'], {
    errorMap: () => ({ message: 'Estado inválido. Use ACTIVO o INACTIVO.' }),
  }).optional(),
  rolId: z.string().optional(),
  buscar: z.string().optional(), // Búsqueda por nombre, username o correo
});



// ──────────────────────────────────────────────
// PUT /users/:id — Editar usuario
// Todos los campos son opcionales (patch parcial)
// ──────────────────────────────────────────────
export const editarUsuarioSchema = z.object({
  nombreCompleto: z
    .string(msg('nombreCompleto'))
    .min(3, 'El nombre completo debe tener al menos 3 caracteres.')
    .max(100, 'El nombre completo no puede superar 100 caracteres.')
    .trim()
    .optional(),

  nombreUsuario: z
    .string(msg('nombreUsuario'))
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres.')
    .max(30, 'El nombre de usuario no puede superar 30 caracteres.')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Solo se permiten letras, números y guiones bajos.'
    )
    .trim()
    .toLowerCase()
    .optional(),

  correo: z
    .string(msg('correo'))
    .email('El formato del correo electrónico no es válido.')
    .trim()
    .toLowerCase()
    .optional(),

  rolId: z
    .string(msg('rolId'))
    .min(1, 'El ID del rol no puede estar vacío.')
    .optional(),
}).refine(
  // Al menos un campo debe ser enviado para editar
  (data) => Object.keys(data).length > 0,
  { message: 'Debes enviar al menos un campo para actualizar.' }
);