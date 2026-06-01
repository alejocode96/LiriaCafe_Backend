// src/config/environment.js
//
// ¿Por qué este archivo?
// ---
// Las variables de entorno son strings. Si alguien olvida definir JWT_SECRET,
// el sistema arrancaría con undefined como secreto, lo cual es un agujero de 
// seguridad catastrófico. Este módulo valida que todas las variables críticas
// existan ANTES de que el servidor arranque.
//
// Usamos dotenv aquí y solo aquí. El resto del sistema importa de este módulo.
import 'dotenv/config';

// Función auxiliar que valida que una variable exista y no esté vacía
const required = (name) =>{
    const value = process.env[name];
    if(!value){
        // Fallo rápido (fail-fast): si falta una variable crítica, el proceso muere
        // con un mensaje claro en lugar de fallar misteriosamente más tarde.
        throw new Error(
            `Variable de entorno requerida no encontrda ${name}\n` +
            ` Copia .env.example a .env y completa el valor`
        );
    }
    return value;
};

//Función auxiliar para variables opcionales con valor por defecto
const optional = (name, defaultValue) =>{
    return process.env[name]?? defaultValue;
};

//Exportamo un objeto con todas las configuraciones ya parseadas y validadas
//El resto del sistema NUNCA accede a procees.env directamente
export const env={
    // Servidor
    NODE_ENV: optional('NODE_ENV', 'development'),
    PORT: parseInt(optional('PORT','3000'),10),
    API_VERSION: optional('API_VERSION','v1'),
    IS_PRODUCTION: optional('NODE_ENV','development')==='production',
    IS_DEVELOPMENT: optional('NODE_ENV','development')==='development',

    //Base de datos
    DATABASE_URL: required('DATABASE_URL'),

    // JWT
    JWT_SECRET: required('JWT_SECRET'),
    JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '8h'),
    JWT_REFRESH_EXPIRES_IN: optional('JWT_REFRESH_EXPIRES_IN', '7d'),

    //Seguridad
    BCRYPT_SALT_ROUNDS: parseInt(optional('BCRYPT_SALT_ROUNDS','12'),10),
    MAX_LOGIN_ATTEMPTS: parseInt(optional('MAX_LOGIN_ATTEMPTS','5'),10),
    LOCK_TIME_MINUTES: parseInt(optional('LOCK_TIME_MINUTES','15'),10),
    PERMANENT_LOCK_AFTER_BLOCKS: parseInt(optional('PERMANENT_LOCK_AFTER_BLOCKS','3'),10),

    //Rate limiting
    RATE_LIMIT_WINDOWS_MS: parseInt(optional('RATE_LIMIT_WINDOW_MS','900000'),10),
    RATE_LIMIT_MAX_REQUESTS: parseInt(optional('RATE_LIMIT_MAX_REQUESTS','100'),10),
    LOGIN_RATE_LIMIT_MAX: parseInt(optional('LOGIN_RATE_LIMIT_MAX','10'),10),

    //Logs
    LOG_LEVEL:optional('LOG_LEVEL','debug'),
    LOG_DIR: optional('LOG_DIR','./logs'),

    //Negocio
    BUSINESS_NAME: optional('BUSINESS_NAME','POS Sistema'),
    BUSINESS_NIT: optional('BUSINESS_NIT',''),
    DEFAULT_TAX_PERCENT: parseFloat(optional('DEFAULT_TAX_PERCENT','0')),



};