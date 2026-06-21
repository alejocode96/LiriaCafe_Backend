// src/modules/users/users.repository.js
import { prisma } from '../../config/database.js';

// ──────────────────────────────────────────────
// PARA: POST /users — Crear usuario
// ──────────────────────────────────────────────

/**
 *  Verifica si ya existe un usuario con ese correo o nombre de usuario
 *  Retorna el usuario encontrado o null
 * 
 *  ¿por qué retornar el usuario y no solo un booleano?
 *  porque necesitamos saber QUÉ  cmapo está duplicado para dar
 *  un mensaje de error específico al frontend.
 */

export const existeUsuario = async(correo, nombreUsuario, excluirId=null)=>{
    return prisma.usuario.findFirst({
        where: {
            OR: [{correo}, {nombreUsuario}],
            //excluirId permite reutilizar esta función en edición
            //para no chocar con el propio registro que se está editando
            ...(excluirId && {NOT: {id: excluirId}}),
        },
        select: {id:true, correo: true, nombreUsuario:true},
    });
};

/**
 *  Busca un rol por Id y verifica que esté activo.
 *  Si el rol está inactivo, no se puede asignar a nuevos usuarios.
 */
export const findRolActivo = async(rolId)=>{
    return prisma.rol.findFirst({
        where:{id: rolId, estado:'ACTIVO'},
        select:{id:true, nombre: true, estado: true, esAdmin: true},
    });
};

/**
 *  Crea el usuario en la BD.
 *  Retorna el usuario con su rol incluido ( sin passwordHash)
 */

export const createUsuario = async ({
    nombreCompleto, nombreUsuario, correo, passwordHash, rolId, creadoPorId,
})=>{
    return prisma.usuario.create({
        data: {
            nombreCompleto,
            nombreUsuario,
            correo,
            passwordHash,
            rolId,
            estado: 'ACTIVO',
            requiereCambioClave: true, //Siempre true en creación
            creadoPorId,
        },
        // Seleccionamos solo los camps seguros - NUNCA retornar passwordHash
        select:{
            id: true,
            nombreCompleto: true,
            nombreUsuario: true,
            correo: true,
            estado: true,
            requiereCambioClave: true,
            ultimoAcceso: true,
            intentosFallidos: true,
            bloqueadoPermanente: true,
            creadoPorId: true,
            createdAt: true,
            updatedAt: true,
            rol:{
                select:{
                    id:true,
                    nombre: true,
                    descripcion:true,
                    esAdmin: true,
                },
            },
        },
    });
};

