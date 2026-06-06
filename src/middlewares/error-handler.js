// src/middlewares/error-handler.js
//
// VERSIÓN CORREGIDA
// Cambios:
// 1. Ahora serializa el campo errors[] de ValidationError
// 2. El stack solo aparece en development
// 3. Manejo específico de errores de Prisma mejorado
// 4. Manejo del AccountLockedError con minutosRestantes

import { env } from '../config/environment.js';
import { logger } from '../logger/index.js';
import { AppError, ValidationError, AccountLockedError } from '../utils/errors.js';

export const errorHandler = (err, req, res, next) => {

  // Log interno del error para diagnóstico del desarrollador
  logger.error('Error capturado por handler global', {
    message: err.message,
    code: err.code,
    statusCode: err.statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    // Solo loguear el stack completo internamente, nunca enviarlo al cliente
    stack: err.stack,
  });

  // ── ERRORES DE PRISMA (ORM) ──────────────────────────────────────
  if (err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    return handlePrismaError(err, res);
  }

  // ── ERRORES DE VALIDACIÓN (con detalle de campos) ────────────────
  if (err instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      message: err.message,
      code: err.code,
      // Este es el array con el detalle de cada campo que falló
      // Es lo que el frontend necesita para mostrar errores por campo
      errors: err.errors ?? [],
      // Stack SOLO en desarrollo, NUNCA en producción
      ...(env.IS_DEVELOPMENT && { stack: err.stack }),
    });
  }

  // ── CUENTA BLOQUEADA (con minutos restantes) ─────────────────────
  if (err instanceof AccountLockedError) {
    return res.status(423).json({
      success: false,
      message: err.message,
      code: err.code,
      minutosRestantes: err.minutosRestantes ?? null,
      ...(env.IS_DEVELOPMENT && { stack: err.stack }),
    });
  }

  // ── ERRORES DE APLICACIÓN GENÉRICOS ─────────────────────────────
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      ...(env.IS_DEVELOPMENT && { stack: err.stack }),
    });
  }

  // ── ERROR DESCONOCIDO (500) ──────────────────────────────────────
  return res.status(500).json({
    success: false,
    message: env.IS_PRODUCTION
      ? 'Error interno del servidor. Contacta al administrador.'
      : err.message || 'Error interno del servidor',
    code: 'INTERNAL_SERVER_ERROR',
    ...(env.IS_DEVELOPMENT && { stack: err.stack }),
  });
};

// Errores específicos de Prisma con mensajes legibles
const handlePrismaError = (err, res) => {
  switch (err.code) {
    case 'P2002':
      // Violación de unicidad — duplicate key
      return res.status(409).json({
        success: false,
        message: `Ya existe un registro con ese valor. Campo: ${err.meta?.target?.join(', ') ?? 'desconocido'}`,
        code: 'DUPLICATE_ENTRY',
      });

    case 'P2025':
      // Record not found
      return res.status(404).json({
        success: false,
        message: 'El registro solicitado no existe.',
        code: 'NOT_FOUND',
      });

    case 'P2003':
      // Foreign key violation
      return res.status(400).json({
        success: false,
        message: 'Referencia inválida: el registro relacionado no existe.',
        code: 'INVALID_REFERENCE',
      });

    default:
      return res.status(500).json({
        success: false,
        message: 'Error de base de datos.',
        code: 'DATABASE_ERROR',
      });
  }
};