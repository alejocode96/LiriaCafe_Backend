// src/logger/index.js
//
// Winston permite:
// - Múltiples niveles de severidad (error, warn, info, http, debug)
// - Múltiples "transports" simultáneos (consola Y archivos)
// - Rotación automática de archivos de log
// - Formato JSON para análisis con herramientas externas (Kibana, Datadog)

import winston from 'winston';
import path from 'path';
import fs from 'fs';
import {env} from '../config/environment.js';

//Crear directorio de logs si no existe
if(!fs.existsSync(env.LOG_DIR)){
    fs.mkdirSync(env.LOG_DIR, {recursive: true});
}

// Niveles de severidad (de menor a mayor gravedad):
// error: 0 — Errores críticos que requieren atención inmediata
// warn:  1 — Situaciones anómalas pero no catastróficas
// info:  2 — Eventos importantes del flujo normal (apertura de caja, etc.)
// http:  3 — Log de peticiones HTTP (Morgan las envía aquí)
// debug: 4 — Información detallada para desarrollo
const levels ={
    error:0,
    warn:1,
    info:2,
    http:3,
    debug:4,
};

//Colores para la consola en desarrollo
const colors ={
    error: 'red',
    warn:'yellow',
    info: 'green',
    http:'magenta',
    debug:'blue',
};
winston.addColors(colors);

//Formato para consola(desarrollo): legible con colroes
const consoleFormat= winston.format.combine(
    winston.format.timestamp({format:'HH:mm:ss'}),
    winston.format.colorize({all: true}),
    winston.format.printf(({timestamp, level, message, ...meta}) =>{
        const metaStr = Object.keys(meta).length? '\n' + JSON.stringify(meta,null, 2): '';
        return `[${timestamp}] ${level}: ${message}${metaStr}`;
    })
);

//Formato para archivos (producción): JSON estructurado,  fácil de parsear
const fileFormat= winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({stack: true}), // Incluye stack trace en errores
    winston.format.json()
);

// El nivel activo determina qué mensajes se registran
// En producción: solo 'warn' y 'error'. En desarrollo: todo hasta 'debug'.
const activeLevel= env.IS_PRODUCTION? 'warn': env.LOG_LEVEL;

export const logger= winston.createLogger({
    level:activeLevel,
    levels,
    transports:[
        //Consola siempre activa, formato legible
        new winston.transports.Console({
            format:consoleFormat,
        }),

        //Archivo de errores: solo errores criticos 
        new winston.transports.File({
            filename: path.join(env.LOG_DIR,'error.log'),
            level:'error',
            format: fileFormat,
            maxsize: 5*1024*1024, // 5mb máximo por archivo
            maxFiles: 5, // Mantemner los últimos 5 archivos
        }),

        //Archivo combinado: todo lo que pasa en el sistema
        new winston.transports.File({
            filename: path.join(env.LOG_DIR, 'combined.log'),
            format: fileFormat,
            maxsize: 10*1024*1024, //10MB Máximo
            maxFiles:10,
        }),
    
    ],
});
