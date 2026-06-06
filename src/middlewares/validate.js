// src/middlewares/validate.js
//
// VERSIÓN CORREGIDA
// Cambios:
// 1. Mapeo correcto de errores de Zod al formato { campo, mensaje, codigo }
// 2. Manejo de errores de validación cruzada (refine) que no tienen path
// 3. El campo 'campo' muestra la ruta completa para campos anidados

import { ValidationError } from '../utils/errors.js';

export const validate = (schema, source = 'body') => {
  return (req, res, next) => {

    const result = schema.safeParse(req[source]);

    if (!result.success) {
      // Mapear cada error de Zod a nuestro formato estándar
      const errors = result.error.errors.map((err) => {
        // err.path es un array: ['confirmarContrasena'] o ['permisos', 0, 'modulo']
        // Si el path está vacío, es un error de nivel raíz (ej: refine entre campos)
        const campo = err.path.length > 0
          ? err.path.join('.')   // ['a', 'b'] → 'a.b'
          : 'general';           // Error de validación cruzada sin campo específico

        return {
          campo,
          mensaje: err.message,
          codigo: err.code,      // 'too_small', 'invalid_string', 'custom', etc.
        };
      });

      return next(
        new ValidationError('Los datos enviados no son válidos.', errors)
      );
    }

    // Reemplazar con datos parseados y transformados por Zod
    // (trimming, toLowerCase, toUpperCase, etc. ya aplicados)
    req[source] = result.data;
    next();
  };
};