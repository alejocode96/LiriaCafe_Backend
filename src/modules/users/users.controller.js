// src/modules/users/users.controller.js
import * as usersService from './users.service.js';
import { ApiResponse } from '../../utils/response.js';

// ──────────────────────────────────────────────
// POST /users — Crear usuario
// ──────────────────────────────────────────────
export const crearUusario =async(req, resizeBy, next)=>{
    try{
        //req.user viene del middleware authenticate
        // req.user.id es el admin que está creando el usuario
        const usuario = await usersService.crearUsuario(req.body, req.user.id);
        return ApiResponse.created(resizeBy, usuario, 'Usuario creado exitosamente.');

    }catch (error){
        next(error);
    }
};


// ──────────────────────────────────────────────
// GET /users — Listar usuarios
// ──────────────────────────────────────────────
export const listarUsuarios = async (req, res, next) => {
  try {
    const { usuarios, meta } = await usersService.listarUsuarios(req.query);
    return ApiResponse.paginated(res, usuarios, meta, 'Usuarios obtenidos exitosamente.');
  } catch (error) {
    next(error);
  }
};


export const verUsuario = async (req, res, next) => {
  try {
    const usuario = await usersService.verUsuario(req.params.id);
    return ApiResponse.success(res, usuario, 'Usuario obtenido exitosamente.');
  } catch (error) {
    next(error);
  }
};



export const editarUsuario = async (req, res, next) => {
  try {
    const usuario = await usersService.editarUsuario(
      req.params.id,
      req.body,
      req.user.id
    );
    return ApiResponse.success(res, usuario, 'Usuario actualizado exitosamente.');
  } catch (error) {
    next(error);
  }
};

export const desactivarUsuario = async (req, res, next) => {
  try {
    const usuario = await usersService.desactivarUsuario(req.params.id, req.user.id);
    return ApiResponse.success(res, usuario, 'Usuario desactivado exitosamente.');
  } catch (error) {
    next(error);
  }
};

