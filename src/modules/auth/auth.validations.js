// src/modules/auth/auth.validations.js
// El problema está en cómo Zod v4 maneja required_error
// Debemos agregar un errorMap global o usar la sintaxis correcta

// REEMPLAZA TODO el archivo con esto:
import { z } from 'zod';

// Helper que traduce los mensajes de Zod al español
// Esto soluciona el "Invalid input: expected string, received undefined"
const mensajesEspanol = (campo) => ({
  required_error: `El campo ${campo} es requerido.`,
  invalid_type_error: `El campo ${campo} tiene un tipo de dato inválido.`,
});

const passwordField = z
  .string(mensajesEspanol('contrasena'))
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(100, 'La contraseña no puede superar 100 caracteres.');

export const registerAdminSchema = z.object({
  nombreCompleto: z
    .string(mensajesEspanol('nombreCompleto'))
    .min(3, 'El nombre debe tener al menos 3 caracteres.')
    .max(100, 'El nombre no puede superar 100 caracteres.')
    .trim(),

  nombreUsuario: z
    .string(mensajesEspanol('nombreUsuario'))
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres.')
    .max(30, 'El nombre de usuario no puede superar 30 caracteres.')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'El nombre de usuario solo puede contener letras, números y guiones bajos.'
    )
    .trim()
    .toLowerCase(),

  correo: z
    .string(mensajesEspanol('correo'))
    .min(1, 'El correo electrónico es requerido.')
    .email('El formato del correo electrónico no es válido.')
    .trim()
    .toLowerCase(),

  contrasena: passwordField,

  confirmarContrasena: passwordField,
}).refine(
  (data) => data.contrasena === data.confirmarContrasena,
  {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmarContrasena'],
  }
);

export const loginSchema = z.object({
  identificador: z
    .string(mensajesEspanol('identificador'))
    .min(1, 'El correo o nombre de usuario es requerido.')
    .trim()
    .toLowerCase(),

  contrasena: z
    .string(mensajesEspanol('contrasena'))
    .min(1, 'La contraseña es requerida.'),
});

export const forgotPasswordSchema = z.object({
  correo: z
    .string(mensajesEspanol('correo'))
    .min(1, 'El correo electrónico es requerido.')
    .email('El formato del correo electrónico no es válido.')
    .trim()
    .toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z
    .string(mensajesEspanol('token'))
    .min(10, 'Token inválido.'),

  nuevaContrasena: passwordField,
  confirmarContrasena: passwordField,
}).refine(
  (data) => data.nuevaContrasena === data.confirmarContrasena,
  {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmarContrasena'],
  }
);

export const changePasswordSchema = z.object({
  contrasenaActual: z
    .string(mensajesEspanol('contrasenaActual'))
    .min(1, 'La contraseña actual es requerida.'),

  nuevaContrasena: passwordField,
  confirmarContrasena: passwordField,
}).refine(
  (data) => data.nuevaContrasena === data.confirmarContrasena,
  {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmarContrasena'],
  }
).refine(
  (data) => data.contrasenaActual !== data.nuevaContrasena,
  {
    message: 'La nueva contraseña no puede ser igual a la contraseña actual.',
    path: ['nuevaContrasena'],
  }
);

export const refreshTokenSchema = z.object({
  refreshToken: z
    .string(mensajesEspanol('refreshToken'))
    .min(10, 'Refresh token inválido.'),
});