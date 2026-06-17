// src/modules/roles/roles.controller.js
//
// Solo maneja req/res. Extrae datos, llama al servicio, responde.
// Toda la lógica de negocio está en el servicio.
import * as rolesService from './roles.service.js';
import { ApiResponse } from '../../utils/response.js';

//POST / roles
export const crearRol = async (req, res, next)=>{
    try{
        const rol = await rolesService.crearRol(req.body, req.user.id);
        return ApiResponse.created(res,rol, 'Rol creado exitosamente.');
    }catch (error){
        next(error);
    }
};

// GET /roles
export const listarRoles = async (req, res, next)=>{
    try{
        const {roles,meta}= await rolesService.listarRoles(req.query);
        return ApiResponse.paginated(res,roles,meta, 'Roles obtenidos exitosamente.');
    } catch (error){
        next(error);
    }
};

// GET /roles/:id
export const verRol = async(req, res,next)=>{
    try{
        const rol = await rolesService.verRol(req.params.id);
        return ApiResponse.success(res,rol,'Rol obtenido exitosamente.')
    } catch (error){
        next(error);
    }
};

// PUT /roles/:id
export const editarRol= async (req,res,next)=>{
    try{
        const rol = await rolesService.editarRol(req.params.id, req.body, req.user.id);
        return ApiResponse.success(res,rol, 'Rol actualizado exitosamente.');
    } catch (error){
        next(error);
    }
};

// PATCH /roles/:id/deactivate
export const desactivarRol = async (req, res, next)=>{
    try{
        const rol = await rolesService.desactivarRol(req.params.id, re.user.id);
        return ApiResponse.success(res,rol,'Rol desactivado exitosamente.');
    }catch (error){
        next(error);
    }
}

// GET /roles/:id/users
export const verUsuariosPorRol= async (req,res,next)=>{
    try{
        const resultado=await rolesService.verUsuariosPorRol(req.params.id, req.query);
        return ApiResponse.paginated(
            res,
            resultado.usuarios,
            resultado.meta,
            `Usuarios del rol "${resultado.rol.nombre}".`
        );
    }catch (error){
        next(error);
    }
}