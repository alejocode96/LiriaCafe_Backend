// src/utils/pagination.js
//
// ¿Por qué paginar?
// Si el negocio tiene 50 roles o 500 usuarios, traer todos de una vez
// es costoso en memoria y lento en red. La paginación trae "páginas"
// de N registros, mejorando el rendimiento y la experiencia del usuario.
//
// Parámetros estándar de query string:
//   GET /roles?page=2&limit=10
//   → página 2, 10 registros por página, skip = (2-1)*10 = 10

/**
 * Estrae y valida los párametros de paginación  del query string.
 * 
 * @param {object} query -  req.query de Express
 * @returns {{page,limit,skip}}
 */
export const parsePagination= (query)=>{
    //Math.max(1,...) garantiza que page nunca sea 0 o negativo
    const page= Math.max(1, parseInt(query.page??'1',10));

    //Math.min(100,...) limita a máximo 100 registros por  página
    //Evita que alguien pida limit=999999 y colapse el servidor
    const limit = Math.min(100, Math.max(1,parseInt(query.limit??'20',10)));

    //skip = cuántos registros saltar (para la query de prisma)
    const skip = (page -1 )*limit;

    return {page, limit, skip}
};

/**
 * Construye el objeto meta de paginacion para la respuesta.
 * 
 * @param {number} total  - Total de registros en la  BD
 * @param {number} page  - Página actual 
 * @param {number} limit - Registros por página
 * @returns {object} Meta con info de paginación
 */
export const buildPaginationMeta= (total, page, limit)=>{
    const totalPages = Math.ceil(total/limit);
    return{
        total,
        page,
        limit,
        totalPages,
        hasNextPage:page<totalPages,
        hasPrevPage:page>1
    };
};