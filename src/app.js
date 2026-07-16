// src/app.js
//
// PATRÓN: Separamos la configuración de Express (app.js) del arranque
// del servidor (server.js). Esto permite importar `app` en los tests
// sin iniciar el servidor real — fundamental para testing con supertest.

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import {env} from './config/environment.js'
import {logger} from './logger/index.js';
import {errorHandler} from './middlewares/error-handler.js';
import {notFound} from './middlewares/not-found.js';
import {setupRoutes} from './routes/index.js';

const app =express();

// ============================================================
// 1. SEGURIDAD: Helmet
// Configura automáticamente ~15 headers HTTP de seguridad:
// - X-Frame-Options: previene clickjacking
// - X-Content-Type-Options: previene MIME sniffing
// - Content-Security-Policy: controla qué recursos puede cargar
// - HSTS: fuerza HTTPS en producción
// ============================================================
app.use(helmet());

// ============================================================
// 2. CORS: Control de Acceso Cross-Origin
// Solo las URLs en CORS_ORIGINS pueden hacer peticiones a la API.
// Esto protege contra peticiones desde orígenes no autorizados.
// ============================================================
// app.use(cors({
//     origin: (origin, callback)=>{
//         //Permitir requests sin origin (ej postman, app móviles) en desarrollo
//         if(!origin && env.IS_DEVELOPMENT){
//             return callback(null, true);
//         }
//         if(env.CORS_ORIGINS.includes(origin)){
//             return callback(null, true)
//         }
//         callback(new Error(`CORS: Origen de permitido -> ${origin}`));
//     },
//     credentials: true, //permite enviar cookies con las peticiones
//     methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
//     allowedHeaders:['Content-Type','Authorization']
// }));

app.use(cors({
  origin: true,   // true = refleja el origen de cada request, acepta todos
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ============================================================
// 3. RATE LIMITING: Protección contra abuso
// Limita el número de peticiones por IP en una ventana de tiempo.
// Crítico para proteger el endpoint de login contra fuerza bruta.
// ============================================================
const globalLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS, // vENTANA DE TIEMPO (15 min por defecto)
    max: env.RATE_LIMIT_MAX_REQUESTS, //Máximo de peticiones por ventana
    message:{
        success:false,
        message: 'Demasiadas peticiones desde esta IP. intenta de neuvo más tarde.',
        code: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true, // Retorna info del límite en headers RateLimit-*
    legacyHeaders: false,
});

app.use('/api/', globalLimiter);

// ============================================================
// 4. PARSING: Procesar body de las peticiones
// ============================================================
app.use(express.json({limit: '10mb'})); //Body JSON
app.use(express.urlencoded({extended: true, limit: '10mb'})); //Form data


// ============================================================
// 5. LOGGING: Registrar todas las peticiones HTTP
// En desarrollo: formato verbose 'dev'
// En producción: formato 'combined' (Apache-style, ideal para análisis)
// ============================================================
const morganFormat = env.IS_DEVELOPMENT?'dev':'combined';
app.use(morgan(morganFormat,{
    //Integramos morgan con nuestro logger winston
    stream:{
        write: (message)=> logger.http(message.trim()),
    },
    // No logueamos peticiones de health check para no llenar los logs
    skip: (req) => req.url ==='/api/health',
}));

// ============================================================
// 6. RUTAS: Todos los endpoints de la API
// ============================================================
setupRoutes(app);

// ============================================================
// 7. MANEJO DE ERRORES (siempre al final)
// El orden importa: Express procesa middlewares en orden de registro.
// notFound debe ir antes de errorHandler.
// ============================================================
app.use(notFound);       // Captura rutas no encontradas → 404
app.use(errorHandler);   // Captura todos los errores → respuesta estandarizada

export { app };