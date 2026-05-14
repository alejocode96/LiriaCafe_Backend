// backend/src/modules/auth/routes.js

const { Router } = require('express');
const controller = require('./controller');
const { loginRules, validate } = require('./validator');
const { authenticate } = require('../../middlewares/auth.middleware');
const rateLimit = require('express-rate-limit');
const env = require('../../config/env');

const router = Router();

/**
 * @module AuthRoutes
 * @description Rutas relacionadas con autenticación de usuarios:
 * login, logout, perfil y refresh de tokens.
 *
 * Incluye protección por rate limiting y middleware de autenticación JWT.
 */

/**
 * @constant loginLimiter
 * @description Limita intentos de login para prevenir ataques de fuerza bruta.
 * Configurado con ventana de 15 minutos y límite definido en variables de entorno.
 *
 * @type {import('express-rate-limit').RateLimitRequestHandler}
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: env.rateLimit.loginMax,
  message: {
    success: false,
    message: 'Demasiados intentos de login. Espera 15 minutos.',
  },
});

/**
 * POST /auth/login
 * @description Autentica usuario y genera tokens de acceso.
 * Incluye validación de payload y protección contra brute force.
 *
 * Middlewares:
 * - loginLimiter: limita intentos de autenticación
 * - loginRules: reglas de validación de campos
 * - validate: verificación de errores de validación
 */
router.post(
  '/login',
  loginLimiter,
  loginRules,
  validate,
  controller.login
);

/**
 * POST /auth/logout
 * @description Cierra sesión del usuario autenticado.
 * Requiere token JWT válido.
 *
 * Middlewares:
 * - authenticate: valida JWT y adjunta usuario al request
 */
router.post(
  '/logout',
  authenticate,
  controller.logout
);

/**
 * GET /auth/me
 * @description Retorna información del usuario autenticado.
 * Requiere autenticación JWT.
 */
router.get(
  '/me',
  authenticate,
  controller.me
);

/**
 * POST /auth/refresh
 * @description Genera nuevos tokens usando refresh token.
 * No requiere middleware de autenticación JWT, pero sí refresh token válido.
 */
router.post(
  '/refresh',
  controller.refresh
);

module.exports = router;