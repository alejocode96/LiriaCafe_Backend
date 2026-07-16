// src/modules/roles/roles.repository.js
//
// Solo queries a la BD. Nada de lógica de negocio aquí.
import { safeParseAsync } from 'zod';
import { prisma } from '../../config/database.js';

// ──────────────────────────────────────────────
// PARA EL ENDPOINT: POST /roles
// ──────────────────────────────────────────────


/**
 * Verifica si ya existe un rol con ese nombre.
 * Usado antes de crear para evitar duplicados.
 * 
 */
export const findRolByNombre = async(nombre)=>{
    return prisma.rol.findUnique({where:{nombre}});
};

/**
 * Crea el rol y todos sus permisos en una sola transacción
 * 
 * ¿Por qué transacción?
 * Si el rol se crea pero los permisos fallan, quedaríamos con un rol
 * sin permisos - estado inválido. la transacción garantiza que se
 * crea todo o no se crea nada
 */
export const createRol = async ({nombre, descripcion, permisos})=>{
    return prisma.$transaction(async (tx)=>{
        //1. Crear el rol
        const rol = await tx.rol.create({
            data:{
                nombre,
                descripcion,
                estado: 'ACTIVO',
                esAdmin: false, // solo el rol semilla puede ser administrador

            },
        });

        //2. Crear todos los permisos de la matriz
        // createMany inserta múltiples filas en una query - más eficiente
        if(permisos.length >0){
            await tx.permiso.createMany({
                data: permisos.map((p)=>({
                    rolId:rol.id,
                    modulo: p.modulo,
                    accion: p.accion,
                    permitido: p.permitido,
                })),
            });
        }

        // 3  Retornar el rol con sus permisos incluidos
        return tx.rol.findUnique({
            where: {id: rol.id},
            include:{permisos:true},
        });
    });
};

// ──────────────────────────────────────────────
// PARA EL ENDPOINT: GET /roles
// ──────────────────────────────────────────────

/**
 * Cuenta roles según filtros (para el meta de paginación).
 */
export const countRoles = async(where)=>{
    return prisma.rol.count({where});
};

/**
 * Lista roles con paginación y filtros opcionales.
 */
export const findRoles = async ({ where, skip, take }) => {
  return prisma.rol.findMany({
    where,
    skip,
    take,
    include: {
      permisos: true,
      _count: { select: { usuarios: true } },
    },
    orderBy: { createdAt: 'desc' }, // ← con 'd' al final
  });
};

// ──────────────────────────────────────────────
// PARA EL ENDPOINT: GET /roles/:id
// ──────────────────────────────────────────────

/**
 * busca un rol pór ID incluyendo todos sus pemrisos
 */

export const findRolById=async (id)=>{
    return prisma.rol.findUnique({
        where: {id},
        include:{
            permisos: true,
            _count: {select: {usuarios: true}},
        },
    });
};

// ──────────────────────────────────────────────
// PARA EL ENDPOINT: PUT /roles/:id
// ──────────────────────────────────────────────

/**
 * Actualiza el rol y reemplaza TODA su matriz de permisos.
 *
 * ¿Por qué reemplazar todos los permisos en lugar de actualizar uno a uno?
 * Es más simple y seguro. Al editar un rol, el admin envía la matriz
 * completa nueva. Borramos los viejos y creamos los nuevos en transacción.
 */
export const updateRol = async (id, {nombre, descripcion,permisos })=>{
    return prisma.$transaction(async (tx)=>{
        //1. Actualizar datos al rol
        const data={};
        if( nombre !== undefined) data.nombre=nombre;
        if(descripcion !== undefined) data.descripcion=descripcion;

        const rol = await tx.rol.update({
            where:{id},
            data,
        });

        // 2. Si se enviaron permisos remplazar la amtriz 
        if(permisos !== undefined){
            //Borrar permisos existentes
            await tx.permiso.deleteMany({where:{rolId:id}});

            //Crear los neuvos permisos
            if(permisos.length >0){
                await tx.permiso.createMany({
                    data: permisos.map((p)=>({
                        rolId: id,
                        modulo: p.modulo,
                        accion: p.accion,
                        permitido: p.permitido,
                    })),
                });
            }
        }

        // 3. Retornar el rol actualizado con permisos
        return tx.rol.findUnique({
        where: { id },
        include: { permisos: true },
        });
    });
};

// ──────────────────────────────────────────────
// PARA EL ENDPOINT: PATCH /roles/:id/deactivate
// ──────────────────────────────────────────────

/**
 * Desactiva un rol (nunca elimina — principio de trazabilidad).
 */

export const desactivarRol = async (id) => {
  return prisma.rol.update({
    where: { id },
    data: { estado: 'INACTIVO' },
    include: { permisos: true },
  });
};

// Agregar en roles.repository.js:
export const contarUsuariosActivosPorRol = async (rolId) => {
  return prisma.usuario.count({
    where: { rolId, estado: 'ACTIVO' },
  });
};


// ──────────────────────────────────────────────
// PARA EL ENDPOINT: GET /roles/:id/users
// ──────────────────────────────────────────────

/**
 * Lista los usuarios asignados a un rol con paginación.
 */
export const findUsuariosByRol = async ({ rolId, skip, take }) => {
  return prisma.usuario.findMany({
    where: { rolId },
    skip,
    take,
    select: {
      id: true,
      nombreCompleto: true,
      nombreUsuario: true,
      correo: true,
      estado: true,
      ultimoAcceso: true,
      createdAt: true,
    },
    orderBy: { nombreCompleto: 'asc' },
  });
};

export const activarRol = async (id) => {
  return prisma.rol.update({
    where: { id },
    data: { estado: 'ACTIVO' },
    include: { permisos: true },
  });
};

export const countUsuariosByRol=async(rolId)=>{
    return prisma.usuario.count({where:{rolId}});
};
