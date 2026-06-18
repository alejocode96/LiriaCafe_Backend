// src/middlewares/validate.js
import { ValidationError } from '../utils/errors.js';

const traducirMensaje = (err) => {
  const mensajesIngles = {
    'Invalid input: expected string, received undefined': 'Este campo es requerido.',
    'Invalid input: expected string, received null': 'Este campo no puede estar vacío.',
    'Required': 'Este campo es requerido.',
    'Expected string, received undefined': 'Este campo es requerido.',
    'Expected string, received null': 'Este campo no puede estar vacío.',
    'Expected number, received undefined': 'Este campo es requerido.',
    'Expected boolean, received undefined': 'Este campo es requerido.',
    'Invalid email': 'El formato del correo electrónico no es válido.',
  };

  if (mensajesIngles[err.message] !== undefined) {
    return mensajesIngles[err.message] ?? err.message;
  }

  if (err.message?.startsWith('Invalid input: expected')) {
    return 'Este campo es requerido o tiene un tipo de dato inválido.';
  }

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

    // req.query es readonly como propiedad del objeto Request
    // pero sus claves internas SÍ son mutables con Object.assign
    if (source === 'query') {
      Object.assign(req.query, result.data);
    } else {
      req[source] = result.data;
    }

    next();
  };
};