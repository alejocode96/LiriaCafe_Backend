// src/utils/bcrypt.js
//
// ¿POR QUÉ NO GUARDAR CONTRASEÑAS EN TEXTO PLANO?
// Si la BD es comprometida, el atacante obtiene todas las contraseñas
// de todos los usuarios. Como la gente reutiliza contraseñas, esto
// compromete sus cuentas bancarias, correos, etc.
//
// CON BCRYPT:
// Guardamos el hash, no la contraseña. Ejemplo:
//   Contraseña: "MiClave123!"
//   Hash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4tbCBGTsOK"
//
// Para verificar, bcrypt aplica el mismo proceso al intento del usuario
// y compara los hashes. NUNCA se puede "revertir" el hash a la contraseña.
//
// EL NÚMERO 12 (salt rounds):
// Bcrypt realiza 2^12 = 4096 iteraciones. En un servidor moderno, hashear
// una contraseña tarda ~250ms. Para un usuario legítimo es imperceptible.
// Para un atacante que prueba millones de contraseñas, es catastrófico.
import bcrypt from 'bcryptjs';
import {env} from '../config/environment.js';

/**
 * Genera el hash seguro de una contraseña.
 * Usa el número de rondas configurado en BCRYPT_SALT_ROUNDS (.env)
 * 
 * @param {string} plainPassword - contraseña en texto plano
 * @returns {Promise <string>} Hash bcrypt de la contraseña
 */
export const hashPassword = async (plainPassword)=>{
    //gentSalty genera un salt aleatorio único para este hash
    const salt= await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
    return bcrypt.hash(plainPassword, salt);
};

/**
 * Compra una contraseña en texto plano con su hash almacenado.
 * Usa comparación en tiempo constante para prevenir timing attacks
 * 
 * @param {string} plainPassword - Contraseña ingresada por el usuario
 * @param {string} hashedPassword - Hash almacenado en la DB
 * @returns {Promise<Boolean>} true si coinciden, false si no
 * 
 */
export const    comparePassword = async (plainPassword, hashedPassword)=>{
    return bcrypt.compare(plainPassword,hashedPassword);
};

