// src/middlewares/validate.js
import { ValidationError } from '../utils/errors.js';

// Traduce los mensajes técnicos de Zod al español
// Funciona con Zod v3 Y v4 independientemente de la versión
const traducirMensaje = (err) => {
  // Si el mensaje ya está en español (viene de .min(), .email(), etc.) lo dejamos
  // Solo traducimos los mensajes automáticos en inglés de Zod
  const mensajesIngles = {
    'Invalid input: expected string, received undefined': 'Este campo es requerido.',
    'Invalid input: expected string, received null': 'Este campo no puede estar vacío.',
    'Required': 'Este campo es requerido.',
    'Expected string, received undefined': 'Este campo es requerido.',
    'Expected string, received null': 'Este campo no puede estar vacío.',
    'Expected number, received undefined': 'Este campo es requerido.',
    'Expected boolean, received undefined': 'Este campo es requerido.',
    'Invalid email': 'El formato del correo electrónico no es válido.',
    'String must contain at least': null, // No traducir, viene de .min() personalizado
  };

  // Buscar coincidencia exacta
  if (mensajesIngles[err.message] !== undefined) {
    return mensajesIngles[err.message] ?? err.message;
  }

  // Buscar coincidencia parcial para mensajes dinámicos
  if (err.message?.startsWith('Invalid input: expected')) {
    return 'Este campo es requerido o tiene un tipo de dato inválido.';
  }

  // Si no hay traducción, devolver el mensaje original
  // (que ya viene en español desde .min(), .email(), .refine(), etc.)
  return err.message ?? 'Valor inválido.';
};

export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const zodErrors = result.error?.errors ?? result.error?.issues ?? [];
      const errorsArray = Array.isArray(zodErrors) ? zodErrors : [];

      const errors = errorsArray.map((err) => ({
        campo: err.path && err.path.length > 0 ? err.path.join('.') : 'general',
        mensaje: traducirMensaje(err),
        codigo: err.code ?? 'invalid_value',
      }));

      return next(new ValidationError('Los datos enviados no son válidos.', errors));
    }

    req[source] = result.data;
    next();
  };
};