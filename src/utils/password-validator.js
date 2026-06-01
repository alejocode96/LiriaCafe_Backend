// src/utils/password-validator.js
//
// El documento de requerimientos especifica exactamente esta política (sección 2.1.2):
// ✓ Mínimo 8 caracteres
// ✓ Al menos una letra mayúscula
// ✓ Al menos una letra minúscula
// ✓ Al menos un número
// ✓ Al menos un carácter especial
// ✓ No puede ser igual a las últimas 3 contraseñas
//
// Separamos esta lógica en su propio módulo por dos razones:
// 1. Se usa en múltiples lugares: registro, cambio de clave, restablecimiento.
// 2. Si la política cambia, se modifica en UN solo lugar.

import {comparePassword} from './bcrypt.js';

//Las reglas como objetos facilitan generar mensajes especificos
const PASSWORD_RULES =[
    {
        id:'length',
        test: (pwd)=> pwd.length >=8,
        message:'Debe tener al menos 8 caracteres'
    },
    {
        id:'uppercase',
        test: (pwd)=> /[A-Z]/.test(pwd),
        message:'Debe contener al menos una letra mayúscula.'
    },
    {
        id:'lowercase',
        test: (pwd)=> /[a-z]/.test(pwd),
        message:'Debe contener al menos una letra minúscula.'
    },
    {
        id:'number',
        test: (pwd)=> /\d/.test(pwd),
        message:'Debe contener al menos un número.'
    },
    {
        id:'special',
        test: (pwd)=> /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
        message:'Debe contener al menos un carácter especial (!@#$%^&*...).',
    }
];

/**
 * Valida que una contraseña cumpla con la política de seguridad del sistema.
 * 
 * @param {string} password - COntraseña a  validar
 * @returns {{valid: boolean, errors: string[], strength: string}}
 * 
 * Ejemplo de uso:
 *      const result = validatePasswordPolicy('MiClave123!');
 *      if (!result.valid) throw new ValidationError('Contraseña invalidad', result.errors);
 */
export const validatePasswordPolicy =(password)=>{
    const errors =[];

    for(const rule of PASSWORD_RULES){
        if(!rule.test(password)){
            errors.push(rule.message);
        }
    }

    //Calcular fortaleza visual (para el frontend )
    //El frontend puede usar este valor para mostrar la barra de fortaleza
    const passedRules= PASSWORD_RULES.length - errors.length;
    let strength ='MUY_DEBIL';
    if(passedRules === 5) strength = 'FUERTE';
    else if (passedRules === 4) strength = 'MEDIA';
    else if (passedRules=== 3) strength='DEBIL';

    return{
        valid: errors.length===0,
        errors,
        strength,
        //Enviamos el detalle de cada regla para el indicador visual del frontend
        rules: PASSWORD_RULES.map((rule)=>({
            id:rule.id,
            passe: rule.test(password),
            message: rule.message,
        })),
    };
};

/** 
 * Verifica que la nueva contraseña NO sea igual a ninguna
 * de las  últimas 3 contraseñas del usuario 
 * 
 * @param {streing} newPassword - Nueva contraseña en texto plano
 * @param {Array<{passwordHash: string}>} historial - Array de hashes anteriores
 * @returns {Promise<boolean>} true si la contraseña en nueva (diferente a todas)
 */
export const isPasswordNew = async( newPassword, historial)=>{
    //Tomamos solo las últimas 3 entardas del historial
    const ultimas3= historial.slice(-3);

    for(const entrada of ultimas3){
        const esMismaCOntrasena= await comparePassword(newPassword, entrada.passwordHash);
        if(esMismaCOntrasena){
            return false; // La contraseña ya fue usada recientemente
        }
    }
    return true; // La contraseña es nueva y puede usarse
};