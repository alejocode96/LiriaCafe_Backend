// src/modules/auth/auth.validations.js
//
// Los schemas Zod definen la "forma" esperada de cada request.
// Son la primera línea de defensa: si los datos no tienen la forma correcta,
// el middleware validate los rechaza ANTES de llegar al controlador.
//
// Principio: NUNCA confíes en los datos que vienen del cliente.
// Valida TODO: tipos, formatos, longitudes, patrones.
 import {z} from 'zod';

 // ──────────────────────────────────────────────
// REUTILIZABLE: campo de contraseña
// Lo definimos una vez y lo reutilizamos en múltiples schemas
// ──────────────────────────────────────────────
const passwordField= z
    .string({required_error:'La contraseña es requerida.'})
    .min(8, 'La contraseña debe tener al menos 8 caracteres. ')
    .max(100, 'La contraseña no puede superar 100 caracteres');

// ──────────────────────────────────────────────
// POST /auth/login
// ──────────────────────────────────────────────
export const loginSchema = z.object({
    //El usuario puede ingresar con correo o nombre de usario 
    //Usamos identificador como campo unificado
    identificador:z
        .string({required_error:'El correo o nombre de usuario es requerido.'})
        .min(3, 'El identificador debe tener al menos 3 caracteres.')
        .trim() //Elimina espacios al inicio y al final
        .toLowerCase(), // Normalizar a minúsculas para comparación consistente

    contrasena: passwordField,
});

// ──────────────────────────────────────────────
// POST /auth/register-admin (registro inicial único)
// ──────────────────────────────────────────────
export const registerAdminSchema= z.object({
    nombreCompleto: z   
        .string({required_error: 'El nombre completo es requerido.'})
        .min(3, 'El nombre debe tener al menos 3 caracteres,')
        .max(100, 'El nombre no puede superar 100 caracteres.')
        .trim(),

    nombreUsuario: z
        .string({required_error:'El nombre de usuario es requerido.'})
        .min(3, 'El nombre de usuario debe tener al menos 3 caracteres.')
        .max(30, 'El nombre de usuario no puede superar 30 caracteres.')
        .regex(
            /^[a-zA-Z0-9_]+$/,
            'El nombre de usuario solo puede contener letras, números y guiones bajos.'
        )
        .trim()
        .toLowerCase(),

    correo: z
        .string({required_error: 'El correo electrónico es requerido.'})
        .email('El formato del correo electrónico no es válido')
        .trim()
        .toLowerCase(),

    contrasena: passwordField,

    //Confirmacion de contraseña - solo en el frontend, buena practica incluirla en API también
    confirmarContrasena: passwordField,
}).refine(
    // .refine permite validaciones cruzadas entre campos
    (data)=> data.contrasena=== data.confirmarContrasena,
    {
        message: 'Las contraseñas no coinciden.',
        path:['confirmarContrasena'], // El error se asocia a este campo
    }
);

// ──────────────────────────────────────────────
// POST /auth/forgot-password
// ──────────────────────────────────────────────.
export const forgotPasswordSchema = z.object({
    correo: z
        .string({required_error:'El correo electrónico es requerido.'})
        .email('El formato del correo electrónico no es válido')
        .trim()
        .toLowerCase(),
});

// ──────────────────────────────────────────────
// POST /auth/reset-password
// ──────────────────────────────────────────────
export const resetPasswordSchema =z.object({
    token: z
        .string({required_error:'El token de restablecimiento es requerido.'})
        .min(10, 'Token inválido.'),
    nuevaContrasena: passwordField,
    confirmarContrasena: passwordField,
}).refine(
    (data)=>data.nuevaContrasena=== data.confirmarContrasena,
    {
        message:'Las contraseñas no coinciden.',
        path:['confirmarContrasena']
    }
);

// ──────────────────────────────────────────────
// POST /auth/change-password (usuario autenticado)
// ──────────────────────────────────────────────
export const changePasswordSchema = z.object({
    contrasenaActual: z
        .string({required_error: 'La contraseña actual es requerida.'})
        .min(1, 'La contraseña actual es requerida'),

    nuevaContrasena: passwordField,

    confirmarContrasena: passwordField,
}).refine(
    (data)=> data.nuevaContrasena === data.confirmarContrasena,
    {
        message:'Las contraseñas no coinciden.',
        path:['confirmarContrasena'],
    }
).refine(
    (data)=> data.contrasenaActual!== data.nuevaContrasena,
    {
        message: 'La nueva contraseña no puede ser igual a la contraseña actual.',
        path:['nuevaContrasena'],
    }
);

// ──────────────────────────────────────────────
// POST /auth/refresh
// ──────────────────────────────────────────────
export const refreshTokenSchema =z.object({
    refreshToken: z
        .string({required_error: 'El refresh token es requerido.'})
        .min(10, 'Refresh token inválido.'),
});