// src/middlewares/validate.js
//
// ¿QUÉ HACE ESTE MIDDLEWARE?
// Es un middleware GENÉRICO que recibe un schema Zod y valida el body
// del request contra ese schema.
//
// Sin validación, un usuario malicioso puede enviar:
//   { "correo": null, "contrasena": "" }
// Y nuestro código fallaría de formas inesperadas.
//
// Con este middleware:
//   router.post('/login', validate(loginSchema), controller)
// El body siempre llega al controlador limpio y con los tipos correctos.
//
// ¿POR QUÉ hacerlo genérico?
// Porque lo vamos a usar en TODOS los módulos. Un solo middleware,
// N schemas diferentes. Principio DRY (Don't Repeat Yourself).

import { ValidationError } from "../utils/errors";

/**
 *  Genera un middleware que valida el req.body con un schema zod
 * @param {import('zod').ZodSchema} schema - schema Zod para validar
 * @param {'body'|'query'|'params'} source - Fuente de datos a validar  (default: 'body')
 * @returns {Function} middleware de Express
 */
export const validate =(schema, source='body')=>{
    return(req,res,next)=>{
        //safeParse de zod devulve {success, data, error} en lugar  de lanzar 
        const result = schema.safeParse(req[source]);

        if(!result.success){
            //Transformamos los errores de zod a un formato legible
            const errors = result.error.errors.map((err)=>({
                campo: err.path.join('.'), // 'correo, 'contrasena.longitud', etc.
                mesaje: err.message,
                codigo: err.code,
            }));

            return next(
                new ValidationError('Los datos enviados no son válidos.', errors)
            );
        }
         //Remplazamos req.body con los datos parseados y transformados por zod
         //Esto limpia y transforma los datos (ej: trimear strings, convertir  tipos)
         req[source]=result.data;

         next()
    };
};