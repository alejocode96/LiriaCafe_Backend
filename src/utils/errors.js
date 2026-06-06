// src/utils/errors.js
//
// VERSIÓN CORREGIDA
// Cambios:
// 1. ValidationError.errors ahora siempre es un array (nunca undefined)
// 2. AccountLockedError guarda minutosRestantes correctamente
// 3. Todas las clases tienen toString() para logging

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'APP_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 400 — Datos inválidos CON detalle de campos
export class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    // Garantizamos que errors SIEMPRE es un array
    // Puede ser: array de strings o array de {campo, mensaje, codigo}
    this.errors = Array.isArray(errors) ? errors : [errors];
  }
}

// 401 — No autenticado
export class AuthenticationError extends AppError {
  constructor(message = 'No autenticado. Se requiere inicio de sesión.') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

// 403 — Sin permisos
export class AuthorizationError extends AppError {
  constructor(message = 'No tienes permisos para realizar esta acción.') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

// 404 — No encontrado
export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado.') {
    super(message, 404, 'NOT_FOUND');
  }
}

// 409 — Conflicto
export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

// 423 — Cuenta bloqueada
export class AccountLockedError extends AppError {
  constructor(message, minutosRestantes = null) {
    super(message, 423, 'ACCOUNT_LOCKED');
    // Guardamos los minutos para que el frontend muestre un contador
    this.minutosRestantes = minutosRestantes;
  }
}

// Funciones factory — más ergonómicas que new
export const createNotFoundError = (msg) => new NotFoundError(msg);
export const createValidationError = (msg, errors) => new ValidationError(msg, errors);
export const createAuthError = (msg) => new AuthenticationError(msg);
export const createForbiddenError = (msg) => new AuthorizationError(msg);
export const createConflictError = (msg) => new ConflictError(msg);