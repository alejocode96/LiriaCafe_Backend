// src/utils/response.js
//
// Estandarizar el formato de TODAS las respuestas de la API es una
// práctica profesional crítica. El frontend espera SIEMPRE la misma
// estructura, independientemente del módulo que responda.
//
// Formato estándar:
// {
//   "success": true|false,
//   "message": "Descripción legible",
//   "data": { ... },          // En respuestas exitosas
//   "meta": { ... },          // Paginación, totales, etc.
//   "errors": [ ... ]         // Detalles de errores de validación
// }

export const ApiResponse ={
    //200 OK - opreción exitosa con datos
    success: (res,data, message='Operación exitosa', statusCode=200) =>{
        return res.status(statusCode).json({
            success: true,
            message,
            data,
        });
    },

    //200 OK - lista paginada
    paginated: (res,data, meta, message='Lista obtenida exitosamente')=>{
        return res.status(200).json({
            success:true,
            message,
            data,
            meta:{
                total: meta.total,
                page:meta.page,
                limit: meta.limit,
                totalPages:Math.ceil(meta.total/meta.limit),
                hasNextPage: meta.page < Math.ceil(meta.total / meta.limit),
                hasPrevPage: meta.page >1,
            },
        });
    },

    //201 created - Recurso creado
    created: (res,data, message='Recurso creado exitosamente')=>{
        return res.status(201).json({
            success:true,
            message,
            data,
        });
    },

    //204 No Content- Operación exitosa sin datos que retornar
    noContent:(res)=>{
        return res.status(204).send();
    }
};

export const parsePagination = (query)=>{
    const page = Math.max(1, parseInt(query.page?? '1',10));
    const limit =Math.min(100, Math.max(1, parseInt(query.limit?? '20',10)));
    const skip =(page-1)*limit;
    return {page, limit,skip};
};