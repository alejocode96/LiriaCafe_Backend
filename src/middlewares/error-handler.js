// src/middlewares/error-handler.js
//
// Este middleware es el "catch global" de toda la aplicación.
// Cualquier error lanzado en controladores, servicios o middlewares
// llega aquí. Esto garantiza que TODOS los errores se manejen de la
// misma forma, sin respuestas inconsistentes.
//
// En Express, un middleware de error tiene CUATRO parámetros: (err, req, res, next)
// Express lo detecta automáticamente por la firma de 4 parámetros.

import {env} from '../config/environment.js';
import {logger} from '../logger/index.js';
import {AppError} from '../utils/errors.js'

export const errorHandler= (err, req, res, next)=>{
    //Logueamos el error para diagnóstico
    logger.error('Erros capturado por handler global',{
        message: err.message,
        statusCode: err.statusCode,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
    });

    //Si el error es de Prisma, lo manejamos específicamente
    if(err.code && err.code.startsWith('P')){
        return handlePrismaError(err,res);
    }

    //Si es nuestro error personalizado (AppError)
    if(err instanceof AppError){
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            code:err.code,
            ...(env.IS_DEVELOPMENT && {stack: err.stack}),

        });
    }

    // Error desconocido → 500 Internal Server Error
    // En producción: mensaje genérico (no exponer detalles internos)
    // En desarrollo: mensaje completo + stack trace
    return res.status(500).json({
        success:false,
        message: env.IS_PRODUCTION
            ? 'Error interno del servidor'
            : err.message || 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR',
        ...(env.IS_DEVELOPMENT && {stack: err.stack}),
    });

}

//Errores especificos de Prisma (ORM)
const handlePrismaError =(err, res)=>{
    switch (err.code){
        case 'P2002':
            //Violación de restricción unica (duplicate key)
            return res.status(409).json({
                success:false,
                message: `Ya existe un registro con ese valor en el campo: ${err.meta?.target?.join(', ')}`,
                code: 'DUPLICATE_ENTRY',
            })

        case 'P2005':
            //Registro no encontrado
            return res.status(404).json({
                success:false,
                message:'Registro no encontrado',
                code:'NOT_FOUND',
            });

        case 'P2003':
            //Violación de foreign key
            return res.status(400).json({
                success:false,
                message:'Referencia inválida: el registro selecionado no existe ',
                code: 'INVALID_REFERENCE',
            });

        default:
            return res.status(500).json({
                success: false,
                message: 'Error de base de datos',
                code: 'DATABASE_ERROR',
            });
    }
};
