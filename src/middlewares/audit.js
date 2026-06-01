javascript// src/middlewares/audit.js
//
//  requiere un log de auditoría completo:
// "registro de cada acción relevante realizada en el sistema
// (quién, qué, cuándo, desde dónde)"
//
// "El log de auditoría es de solo lectura. Nadie puede modificarlo ni eliminarlo."
//
// Este middleware se usa de dos formas:
// 1. Como factory (auditAction): para registrar acciones específicas desde los servicios
// 2. Como middleware de ruta: para registrar automáticamente acciones HTTP

import {prisma} from '../config/database.js';
import {logger} from '../logger/index.js';

/**
 * Registra una acción en el log de auditoria.
 * Función pura que puede llamarse desde cualquier servicio.
 * 
 * @param {object} params
 * @param {string} params.accion - Descripción de la acción (ej: 0LOGIN,'CREAR_USUARIO')
 * @param {string|null} params.usuarioId - ID del usuario que realizó la acción
 * @param {string|null} params.entidad - Entidad afectada (ej: 'Usuario', 'Venta')
 * @param {string|null} params.entidadId - ID del registro afectado
 * @param {object|null} params.detalle - Datos adicionales (cambios antes/después)
 * @param {string|null} params.ip - IP del cliente
 * @param {string|null} params.userAgent - User agent del cliente
 * 
 */
export const  registrarAuditoria= async({
    accion,
    usuarioId= null,
    entidad=null,
    entidadId=null,
    detalle=null,
    ip=null,
    userAgent =null,
})=>{
    try{
        await prisma.logAuditoria.create({
            data:{
                accion,
                usuarioId,
                entidad,
                entidadId,
                //Serializar el detalle como JSON stirng para guardarlo en SQLite
                detalle: detalle? JSON.stringify(detalle): null,
                ip,
                userAgent,
            },
        });
    }catch(error){
        // Si el log de auditoria falla, No debe interrumpir la operacion principal
        //Solo logueamos el error internamente.
        logger.error('Error al registrar auditoria', {error: error.message, accion});
    }
};

/**
 * Factory de middleware para auditar automáticamente un endpoint.
 * se ejecuta DESPUÉS de controlador ( en el camino de respuesta).
 * 
 * @param {string} accion - Nombre de la acción a registrar
 * @param {string} entidad - Entidad afectada
 * @returns {Function} Middleware de Express
 * 
 * Uso:
 *  router.post('/login', validate(schema), controller, auditMiddleware('LOGIN' ,'Usuario'))
 */
export const auditMiddleware =(accion, entidad = null)=>{
   return async (req,res,next)=>{
      //Guardamos la función original de res.json para interceptarla
        const originalJson = res.json.bind(res);

        res.json= async function (body){
            //solo auditamos si la respuesta fue exitosa (status2xx)
            if (res.statusCode>= 200&& res.statusCode<300){
                await registrarAuditoria({
                    accion,
                    usuarioId: req.user?.id?? null,
                    entidad,
                    entidadId: body?.data?.id?? req.params?.id?? null,
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                });
            }

            // llamar al jhson oriignal
            return originalJson(body);
        };
        next();
   }

}