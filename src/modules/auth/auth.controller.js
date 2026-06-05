// src/modules/auth/auth.controller.js
//
// ¿QUÉ HACE EL CONTROLADOR?
// Es el intermediario entre HTTP y el servicio.
// Su única responsabilidad es:
// 1. Extraer datos del request (body, params, headers, user)
// 2. Llamar al servicio con esos datos
// 3. Responder con el formato estándar
//
// Lo que el controlador NUNCA debe hacer:
// - Lógica de negocio (eso va en el servicio)
// - Queries a la BD (eso va en el repositorio)
// - Cálculos complejos (eso va en el servicio)
//
// Los controladores son tan simples que raramente necesitan tests unitarios.
// Los tests importantes son los de integración (endpoint completo).

import * as authService from './auth.service.js';
import {ApiResponse} from '../../utils/response.js';

// ──────────────────────────────────────────────
// POST /auth/register-admin
// ──────────────────────────────────────────────
export const registerAdmin = async (req, res, next)=>{
    try{
        const resultado = await authService.registrarAdmin(req.body);
        return ApiResponse.created(res, resultado, 'Administrador registrado exitosamente.');
    } catch (error){
        next(error)
    }
};

// ──────────────────────────────────────────────
// POST /auth/login
// ──────────────────────────────────────────────
export const login = async (req, res, next)=>{
    try{
        const resultado = await authService.login({
            ...req.body,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
        return ApiResponse.success(res, resultado, 'Inicio de sesión exitoso.');

    }catch (error){
        next(error);
    }
};

// ──────────────────────────────────────────────
// POST /auth/logout
// ──────────────────────────────────────────────
export const logout = async(req,res,next)=>{
    try{
        const resultado = await authService.logout({
            usuarioId: req.user.id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
        return ApiResponse.success(res, null, resultado.message);
    } catch(error){
        next(error);
    }
};

// ──────────────────────────────────────────────
// GET /auth/me
// ──────────────────────────────────────────────
export const me = async(req,res,next)=>{
    try{
        // req.user ya fue adjuntado por el middleware authenticate
        // Llamamos al servicio para obtener el perfil completo y fresco de la BD
        const perfil = await authService.miPerfil(req.user.id);
        return ApiResponse.success(res, perfil,'Perfil obtenido exitosamente.');
    } catch (error){
        next(error);
    }
};


// ──────────────────────────────────────────────
// POST /auth/forgot-password
//
export const forgotPassword = async (req, res, next)=>{
    try{
        const resultado = await authService.solicitarRestablecimiento({
            correo: req.body.correo,
            ip: req.ip,
        });
        return ApiResponse.success(res, resultado, resultado.message);
    } catch (error){
        next(error);
    }
};

// ──────────────────────────────────────────────
// POST /auth/reset-password
// ──────────────────────────────────────────────
export const resetPassword = async (req,res, next)=>{
    try{
        const resultado = await authService.restablecerContrasena({
            token: req.body.token,
            nuevaContrasena: req.body.nuevaContrasena,
            ip: req.ip,
        });
        return ApiResponse.success(res, null, resultado.message);
    } catch(error){
        next(error);
    }
};

// ──────────────────────────────────────────────
// POST /auth/change-password
// ──────────────────────────────────────────────
export const changePassword = async (req, res, next)=>{
    try{
        const resultado = await authService.cambiarContrasena({
            usuarioId: req.user.id,
            contrasenaActual: req.body.contrasenaActual,
            nuevaContrasena: req.body.nuevaContrasena,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
        return ApiResponse.success(res, null, resultado.message);
    } catch (error){
        next(error);
    }
};

// ──────────────────────────────────────────────
// POST /auth/refresh
// ──────────────────────────────────────────────
export const refresh =async (req, res, next)=>{
    try{
        const resultado = await authService.refreshToken({
            token: req.body.refreshToken,
        });
        return ApiResponse.success(res, resultado,'Token renovado exitosamente.')
    }catch(error){
        next(error);
    }
};

