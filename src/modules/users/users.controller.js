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

