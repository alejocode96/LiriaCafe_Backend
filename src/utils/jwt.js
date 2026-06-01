// src/utils/jwt.js
//
// ¿QUÉ ES UN JWT?
// Un JWT tiene 3 partes separadas por puntos:
//   HEADER.PAYLOAD.SIGNATURE
//
// HEADER: algoritmo de firma (HS256 por defecto)
// PAYLOAD: datos que guardamos (userId, rol, etc.) — NO es secreto, es Base64
// SIGNATURE: HMAC-SHA256(header + payload, JWT_SECRET) — garantiza que no fue alterado
//
// IMPORTANTE: El payload de un JWT es PÚBLICO (cualquiera puede decodificarlo).
// La SIGNATURE garantiza que no fue alterado, pero no lo cifra.
// Por eso NUNCA guardamos datos sensibles (contraseñas) en el payload.
//
// ¿POR QUÉ DOS TOKENS? (access + refresh)
// El access token vive poco (8 horas) — si es robado, el daño es limitado.
// El refresh token vive más (7 días) — solo se usa para renovar el access token.
// Esta es la práctica estándar de la industria.

import jwt from 'jsonwebtoken';
import {env} from '../config/environment.js';
import {AuthenticationError} from './errors.js'

//----------------------------------------------------------------------------
// FIRMAR TOKENS
//----------------------------------------------------------------------------

/**
 * Genera un Acces Token JWT para el usuario autenticado.
 * Este Token se enviará en cada request como: Authorization: Beares <token>
 * 
 * @param {object} payload - Datos del usuario a incluir en el token
 * @param {string} payload.userId - ID único del usuario
 * @param {string} payload.rolId -ID del rol asignado
 * @param {string} payload.rolNombre - Nombre del rol (para logs)
 * @returns {string}  Token JWT firmado
 */

export const signAccesToken =(payload)=>{
    return jwt.sign(
        {
            sub: payload.userId, // 'sub' (subject) es la convención JWT para el ID
            rolId:payload.rolId,
            rolNombre: payload.rolNombre,
            type:'access', // Distinguimos acces de refresh tokens
        },
        env.JWT_SECRET,
        {
            expiresIn: env.JWT_EXPIRES_IN, // '8h' por defecto (configurable en .env)
            issuer: 'pos-system', //Identifica quién emitió el token
            audience: 'pos-client', //Identifica para quién es el token
        }
    )
};

/**
 *  Genera un Refresh Token JWT
 *  Solo contiene el userId - menos información expuesta.
 * 
 * @param {string} userId - ID del usuario
 * @returns {string}  Refresh token JWT firmado
 */
export const signRefreshToken =(userId)=>{
    return jwt.sign(
        {
            sub:userId,
            type: 'refresh',
        },
        env.JWT_SECRET,
        {
            expiresIn: env.JWT_REFRESH_EXPIRES_IN, //'7d' por defecto
            issuer:'pos-system',
            audience:'pos-client',
        }
    );
};

//----------------------------------------------------------------------------
// VERIFICAR TOKENS
//----------------------------------------------------------------------------

/**
 * Verifica y decodifica un Acces Token.
 * Lanza AuthenticationError si el token es inválido o expiró
 * 
 * @param {string} token - Token JWT a verificar
 * @returns {object} payload decodificado del token
 */
export const verifyAccesToken=(token)=>{
    try{
        const decoded= jwt.verify(token, env.JWT_SECRET,{
            issuer:'pos-system',
            audience:'pos-client',
        });

        //Verificamo que sea un acces token ( no un refresh token reutilizado)
        if(decoded.type !=='access'){
            throw new AuthenticationError('Tipo de token inválido,');
        }

        return decoded;
    }catch (error){
        //jwt.verify lanza errores especificos que traduciomos a nuestros errores
        if(error instanceof AuthenticationError) throw error;

        if(error.name === 'TokenExpiredError'){
            throw  new AuthenticationError('Token inválido.');
        }

        if(error.name === 'NotBeforeError'){
            throw new AuthenticationError('Token aún no es válido');
        }

        throw new AuthenticationError('Error al verificar el token')
    }
};

/**
 * Verifica y decodifica un Refresh Token.
 * @param {string}  token - Refresh token JWT a verificar
 * @returns {object} payload decodificado
 */
export const verifyRefreshToken =(token)=>{
    try{
        const decoded = jwt.verify(token, env.JWT_SECRET,{
            issuer:'pos-system',
            audience: 'pos-client',
        });

        if(decoded.type !== 'refresh'){
            throw new AuthenticationError('Tipo de token inválido.')
        }

        return decoded;
    }catch (error){
        if (error instanceof AuthenticationError) throw error;

        if(error.name === 'TokenExpiredError'){
            throw new AuthenticationError ('El refresh token ha expirado. por favor inicia sesión.');
        }

        throw new AuthenticationError('Refresh token inválido.');
    }
};

/**
 * Extrae el token del header Authorization.
 * Formato esperado: "Bearer eyJhbci0iJIUzI1nij9"
 * @param {string} authHeader - valor del header Authorization
 * @returns {string | null } El token sin el prefijo "Bearer", o null
 */
export const extractTokenFromHeader =(authHeader)=>{
    if(!authHeader || !authHeader.startsWith('Bearer ')){
        return null;
    }
    // "Bearer TOKEN" -> separamos por espacio y tomamos el segundo elemento
    return authHeader.split(' ')[1]?? null;
};