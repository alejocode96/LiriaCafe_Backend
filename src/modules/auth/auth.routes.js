// src/modules/auth/auth.routes.js
//
// Las rutas conectan URLs con controladores y definen qué middlewares
// se aplican a cada endpoint.
//
// ORDEN DE MIDDLEWARES EN UNA RUTA:
// router.post('/endpoint', [rateLimit], [validate], [authenticate], [authorize], controller)
//
// El orden importa: cada middleware puede detener la cadena llamando a next(error).
// Validamos ANTES de autenticar para no desperdiciar consultas a la BD
// con datos inválidos.

import {Router} from 'express';
import rateLimit from 'express-rate-limit';

import * as authController from './auth.controller.js';
import {authenticate} from '../../middlewares/authenticate.js';
import {validate} from '../../middlewares/validate.js'
import {
  loginSchema,
  registerAdminSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  refreshTokenSchema,
} from './auth.validations.js';
import { env } from '../../config/environment.js';
import { success } from 'zod';

const router = Router();

// ──────────────────────────────────────────────
// RATE LIMITER ESPECIAL PARA LOGIN
// Más restrictivo que el global: máx 10 intentos por 15 minutos
// Protección adicional contra ataques de fuerza bruta al login
// El documento requiere bloqueo a nivel de BD también (sección 2.1.3)
// pero este rate limiting es la primera barrera a nivel de red
// ──────────────────────────────────────────────
const loginRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.LOGIN_RATE_LIMIT_MAX,
  message: {
    success: false,
    message: 'Demasiados intentos de inicio de sesión. Espera 15 minutos.',
    code: 'LOGIN_RATE_LIMIT',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Sin keyGenerator — express-rate-limit maneja IPv6 automáticamente
});

//Rate limiter para forgot-password (más permisivo)
const forgotPasswordRateLimiter = rateLimit({
    windowMs: 60*60*1000, // 1 hora
    max: 5,
    message:{
        success:false,
        message:'Demasiadas solicitudes de restablecimiento, Espera 1 hora.',
        code: 'RATE_LIMIT_EXCEEDED',
    },
});

// ──────────────────────────────────────────────
// RUTAS PÚBLICAS (sin autenticación)
// ──────────────────────────────────────────────

/**
 * POST /api/v1/auth/register-admin
 * Registro único del administrador inicial.
 * Solo funciona si no existe ningún admin en el sistema.
 */

router.post(
    '/register-admin',
    validate(registerAdminSchema),
    authController.registerAdmin
);

/**
 * POST /api/v1/auth/login
 * Inicio de sesión con correo o nombre de usuario.
 */
router.post(
    '/login',
    loginRateLimiter, // Protección de fuerza bruta
    validate(loginSchema), // validar formato de datos
    authController.login
);

/**
 * POST /api/v1/auth/forgot-password
 * Solicitar token de restablecimiento de contraseña.
 */
router.post(
    '/forgot-password',
    forgotPasswordRateLimiter,
    validate(forgotPasswordSchema),
    authController.forgotPassword
);

/**
 * POST /api/v1/auth/reset-password
 * Restablecer contraseña con token recibido.
 */
router.post(
    '/reset_password',
    validate(resetPasswordSchema),
    authController.resetPassword
);

/**
 * POST /api/v1/auth/refresh
 * Renovar access token con refresh token válido.
 */
router.post(
    '/refresh',
    validate(refreshTokenSchema),
    authController.refresh
);

// ──────────────────────────────────────────────
// RUTAS PROTEGIDAS (requieren autenticación)
// ──────────────────────────────────────────────

/**
 * GET /api/v1/auth/me
 * Obtener perfil del usuario autenticado.
 */

router.get(
    '/me',
    authenticate,
    authController.me
);

/**
 * POST /api/v1/auth/logout
 * Registrar cierre de sesión.
 */
router.post(
    '/logout',
    authenticate,
    authController.logout
);

/**
 * POST /api/v1/auth/change-password
 * Cambiar contraseña del usuario autenticado.
 */
router.post(
    '/change-password',
    authenticate,
    validate(changePasswordSchema),
    authController.changePassword
);

export default router;