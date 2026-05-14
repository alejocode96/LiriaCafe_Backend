// backend/src/modules/auth/validator.js
// ─────────────────────────────────────────────────────────────
// CAPA VALIDATOR - Módulo de Autenticación
// -------------------------------------------------------------
// Responsabilidad:
// Validar y sanear datos entrantes antes de llegar al controller.
//
// Objetivos:
//
// - Evitar requests incompletos
// - Reducir errores de negocio
// - Normalizar entradas
// - Mejorar seguridad básica
// - Responder errores consistentes
//
// Herramienta usada:
// express-validator
//
// Flujo:
//
// Request
//   ↓
// Validator
//   ↓
// Controller
//   ↓
// Service
// ─────────────────────────────────────────────────────────────

const {
  body,
  validationResult,
} = require('express-validator');

const {
  badRequest,
} = require('../../utils/response');

/**
 * Reglas de validación para login.
 *
 * Body esperado:
 * {
 *   username: string,
 *   password: string
 * }
 *
 * Reglas:
 * - username obligatorio
 * - username sin espacios extremos
 * - password obligatorio
 */
const loginRules = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Usuario requerido'),

  body('password')
    .notEmpty()
    .withMessage('Contraseña requerida'),
];

/**
 * Middleware que procesa el resultado
 * de express-validator.
 *
 * Si existen errores:
 * retorna HTTP 400.
 *
 * Si todo está correcto:
 * continúa al siguiente middleware.
 *
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  /**
   * Si hay errores de validación
   */
  if (!errors.isEmpty()) {
    return badRequest(
      res,
      'Datos inválidos',
      errors.array()
    );
  }

  /**
   * Continúa flujo normal
   */
  next();
};

/**
 * Exportación pública del módulo.
 */
module.exports = {
  loginRules,
  validate,
};