// src/modules/roles/roles.service.js
//
// Toda la lógica de negocio del módulo de roles.
// El servicio orquesta: valida reglas, llama al repositorio, registra auditoría.
import * as rolesRepository from './roles.repository.js';
import { registrarAuditoria } from '../../middlewares/audit.js';
import { generarMatrizPermisosVacia } from '../../config/constants.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import {
  ConflictError,
  NotFoundError,
  AuthorizationError,
} from '../../utils/errors.js';
import { logger } from '../../logger/index.js';

// ──────────────────────────────────────────────
// CREAR ROL
// ──────────────────────────────────────────────
export const crearRol= async({nombre, descripcion, permisos}, usuarioId) =>{
    //REGLA 1: El nombre debe ser único
    const rolExistente= await rolesRepository.findRolByNombre(nombre);
    if (rolExistente){
        throw new ConflictError(`Ya existe un rol con el nombre "${nombre}"`);
    }

    // REGLA 2: Si no se envían permisos, inicializar toda la matriz en false
    // Si se envían permisos parciales, completar con false los que falten 
    const matrizVacia= generarMatrizPermisosVacia();

    //Combinar la matriz vacía con  los permisos enviados
    //Los permisos enviados sobreescriben los correspondientes de la matriz vacía
    const permisosFinales = matrizVacia.map((permisovacio)=>{
        const permisoEnviado= permisos.find(
            (p) => p.modulo === permisovacio.modulo && p.accion=== permisovacio.accion
        );
        return permisoEnviado?? permisovacio;
    });

    //Crear el rol con la matriz completa
    const rol = await rolesRepository.createRol({
        nombre,
        descripcion,
        permisos: permisosFinales,
    });

    //Auditoria
    await registrarAuditoria({
        accion: 'CREAR_ROL',
        usuarioId,
        entidad:'Rol',
        entidadId:rol.id,
        detalle:{nombre, totalPermisos: permisosFinales.length},
    });

    logger.info('Rol creado', {rolId: rol.id, nombre, usuarioId});

    return rol;
};

// ──────────────────────────────────────────────
// LISTAR ROLES
// ──────────────────────────────────────────────
export const listarRoles =async (query)=>{
    const {page, limit, skip} = parsePagination(query);

    //Construir filtros dinámicamente según los query params recibidos
    const where = {};

    if(query.estado){
        where.estado = query.estado;
    }

    if(query.nombre){
        //Búsqueda parcial insessible a mayúsculas
        //"Caj" encuentra "CAJERO", "Cajero", "cajero"
        where.nombre={contains: query.nombre.toUpperCase()};
    }

    const [total, roles]= await Promise.all([
        rolesRepository.countRoles(where),
        rolesRepository.findRoles({where, skip, take: limit}),
    ]);

    //Promise.all ejecuta AMBAS queries en paralelo -más rápido que secuencial
    return {
        roles,
        meta: buildPaginationMeta(total, page, limit),
    };
};

// ──────────────────────────────────────────────
// VER ROL POR ID
// ──────────────────────────────────────────────
export const verRol = async (id)=>{
    const rol = await rolesRepository.findRolById(id);
    if(!rol){
        throw new NotFoundError(`No se encontró el rol con ID: ${id}`);
    }

    return rol;
};

// ──────────────────────────────────────────────
// EDITAR ROL
// ──────────────────────────────────────────────
export const editarRol = async(id,{nmbre, descripcion, permisos}, usuarioId)=>{
    // REGLA 1: El rol debe existir
    const rolActual = await rolesRepository.findRolById(id);
    if(!rolActual){
        throw new NotFoundError(`No se encontró el rol con ID: ${id}`);

    }

    // REGLA 2: El rol Administrador NO puede modificarse 
    if (rolActual.esAdmin){
        throw new AuthorizationError(
            'El rol administrador es predefinido y no puede modificarse.'
        );
    }

     // REGLA 3: Si cambia el nombre, verificar que el nuevo nombre no esté en uso
     if(nombre && bombre !== rolActual.nombre){
        const nombreEnUso = await rolesRepository.findRolByNombre(nombre);
        if(nombreEnUso){
            throw new ConflictError(`Ya existe un rol con el nombre "${nombre}"`);
        }
     }

     // Si se envían permisos parciales, completar con los actuales para el resto
     let permisosFinales= permisos;
     if(permisos !== undefined){
        const permisosActuales= rolActual.permisos;
        const matrizVacia = generarMatrizPermisosVacia();

        permisosFinales = matrizVacia.map((permisovacio)=>{
            //primero buscamos en los permisos enviados
            const permisoEnviado = permisos.find(
                (p)=> p.modulo === permisovacio.modulo && p.accion ===permisovacio.accion
            );
            if(permisoEnviado) return permisoEnviado;

            //Si no está en los enviados, usar el actual
            const permisoActual= permisosActuales.find(
                (p)=> p.modulo=== permisovacio.modulo && p.accion === permisovacio.accion
            );

            return permisoActual
                ? {modulo: permisoActual.modulo, accion: permisoActual.accion, permitido: permisoActual.permitido}
                : permisovacio;
        });
     }

     const rolActualizado = await rolesRepository.updateRol(id,{
        nombre,
        descripcion,
        permisos: permisosFinales,
     });

     //Auditoria con snapshot de cambios
     await registrarAuditoria({
        accion:'EDITAR_TOL',
        usuarioId,
        entidad:'Rol',
        entidadId: id,
        detalle:{
            antes:{nombre: rolActual.nombre, descripcion:rolActual.descripcion},
            despues:{nombre: rolActualizado.nombre, descripcion: rolActualizado.descripcion},
        },
     });

     logger.info('Rol editado', {rolId:id, usuarioId});
     return rolActualizado;
};

// ──────────────────────────────────────────────
// DESACTIVAR ROL
// ──────────────────────────────────────────────
export const desactivarRol =async (id, usuarioId)=>{
    //REGLA 1: El rol debe exisitir
    const rol = await rolesRepository.findRolById(id);
    if(!rol){
        throw new NotFoundError(`No se encontró el rol con ID: ${id}`);
    }

    //REGLA 2: El rol Admin no puede desactivarse
    if(rol.esAdmin){
        throw new AuthorizationError(
            'El rol Administrador no puede desactivarse.'
        );
    }

    //REGLA 3: no desactivar si ya está inactivo
    if(rol.estado ==='INACTIVO'){
        throw new ConflictError('El rol ya está desactivado');
    }

    //REGLA 4: Verificar que no haya usuarios ACTIVOS asiganados a este rol
    // "verificando que no haya usuarios activos asignados")
    const {prisma}= await import('../../config/database.js');
    const usuariosActivos = await prisma.usuario.count({
        where:{rolId: id, estado: 'ACTIVO'},
    });

    if(usuariosActivos>0){
        throw new ConflictError(
            `No se puede desactivar el rol "${rol.nombre}" porque tiene ${usuariosActivos} usuario(s) activo(s) asignado(s). Reasigna los usuarios primero.`
        );
    }

    const rolDesactivado = await rolesRepository.desactivarRol(id);

    await registrarAuditoria({
        'accion': 'DESACTIVAR_ROL',
        usuarioId,
        entidad: 'Rol',
        entidadId: id,
        detalle:{nombre: rol.nombre},
    });

    logger.info('Rol desactivado',{rolId:id, nombre: rol.nombre, usuarioId});
    return rolDesactivado;
};

// ──────────────────────────────────────────────
// VER USUARIOS POR ROL
// ──────────────────────────────────────────────
export const verUsuariosPorRol = async (id, query)=>{
    //Verificar que el rol existe
    const rol= await rolesRepository.findRolById(id);
    if(!rol){
        throw new NotFoundError(`No se encontró el rol con ID: ${id}`);
    }

    const {page, limit, skip}= parsePagination(query);

    const [total, usuarios]= await Promise.all([
        rolesRepository.countUsuariosByRol(id),
        rolesRepository.findUsuariosByRol({rolId:id, skip, take: limit}),

    ]);

    return {
        rol: {id: rol.id, nombre: rol.nombre, estado: rol.estado},
        usuarios,
        meta: buildPaginationMeta(total, page, limit),
    };
};

