// src/middlewares/not-found.js
//
// Cuando ninguna ruta coincide con la petición, Express llega aquí.
// En lugar de dejar que Express envíe su HTML por defecto,
// respondemos con nuestro formato JSON estándar.

import {createNotFoundError} from '../utils/errors.js';

export const notFound= (req, res, next)=>{
    next(createNotFoundError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));

};

