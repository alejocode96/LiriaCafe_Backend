/**
 * ============================================================
 * Archivo: backend/src/app.js
 * Propósito:
 * Configuración principal de la aplicación Express.
 *
 * Este archivo ensambla toda la API:
 * - Seguridad HTTP
 * - CORS
 * - Rate limiting
 * - Parsing JSON/FormData
 * - Compresión
 * - Logging
 * - Archivos estáticos
 * - Rutas principales
 * - Health check
 * - Manejo global de errores
 *
 * Es el núcleo operativo del backend.
 *
 * Flujo general:
 * Request -> Seguridad -> Parsers -> Logs -> Rutas -> Errores
 *
 * Porque lanzar Express sin estructura suele terminar
 * como una cocina en incendio.
 * ============================================================
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

/**
 * ============================================================
 * Configuración interna
 * ============================================================
 */

const env = require('./config/env');
const logger = require('./config/logger');

const loggerMiddleware =
  require('./middlewares/logger.middleware');

const {
  errorMiddleware,
  notFoundMiddleware,
} = require('./middlewares/error.middleware');

const routes = require('./routes');

/**
 * ============================================================
 * Instancia principal Express
 * ============================================================
 */

const app = express();

/**
 * ============================================================
 * SEGURIDAD HTTP
 * ============================================================
 *
 * Helmet agrega headers de protección:
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - CSP parciales
 * - Protección básica navegador
 *
 * cross-origin habilitado para servir imágenes.
 */

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

/**
 * ============================================================
 * CORS
 * ============================================================
 *
 * Controla qué dominios pueden consumir la API.
 *
 * Valores permitidos vienen desde:
 * .env -> CORS_ORIGINS
 *
 * También permite requests sin origin:
 * - Postman
 * - Apps desktop
 * - Curl
 */

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        env.cors.origins.includes(origin)
      ) {
        callback(null, true);
      } else {
        callback(
          new Error(
            `CORS bloqueado para origen: ${origin}`
          )
        );
      }
    },

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
    ],

    credentials: true,
  })
);

/**
 * ============================================================
 * RATE LIMITING
 * ============================================================
 *
 * Protege la API contra abuso:
 * - spam
 * - bots
 * - brute force básico
 * - exceso accidental de requests
 */

const generalLimiter = rateLimit({
  windowMs:
    env.rateLimit.windowMs,

  max:
    env.rateLimit.max,

  message: {
    success: false,
    message:
      'Demasiadas peticiones. Intenta más tarde.',
  },

  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Solo aplica a endpoints API
 */

app.use(
  '/api/',
  generalLimiter
);

/**
 * ============================================================
 * BODY PARSERS
 * ============================================================
 *
 * Soporta:
 * - JSON
 * - forms urlencoded
 *
 * Límite:
 * 10 MB
 */

app.use(
  express.json({
    limit: '10mb',
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  })
);

/**
 * ============================================================
 * COMPRESIÓN
 * ============================================================
 *
 * Reduce tamaño de respuestas:
 * - JSON
 * - texto
 * - assets compatibles
 */

app.use(
  compression()
);

/**
 * ============================================================
 * LOGGING HTTP
 * ============================================================
 *
 * Registra cada request:
 * método, ruta, tiempo, status.
 */

app.use(
  loggerMiddleware
);

/**
 * ============================================================
 * ARCHIVOS ESTÁTICOS
 * ============================================================
 *
 * Ejemplo:
 * /storage/images/producto.jpg
 *
 * Carpeta física:
 * backend/storage/
 */

app.use(
  '/storage',
  express.static(
    path.join(
      __dirname,
      '..',
      'storage'
    )
  )
);

/**
 * ============================================================
 * RUTAS PRINCIPALES API
 * ============================================================
 *
 * Prefijo versionado:
 * /api/v1
 */

app.use(
  '/api/v1',
  routes
);

/**
 * ============================================================
 * HEALTH CHECK
 * ============================================================
 *
 * Endpoint simple para monitoreo:
 * GET /health
 *
 * Útil para:
 * - Render
 * - Railway
 * - Docker
 * - uptime monitors
 * - balanceadores
 */

app.get(
  '/health',
  (req, res) => {
    res.json({
      status: 'ok',
      service:
        'LIRIACAFE POS Backend',
      version: '1.0.0',
      timestamp:
        new Date().toISOString(),
      env: env.nodeEnv,
    });
  }
);

/**
 * ============================================================
 * MANEJO GLOBAL DE ERRORES
 * ============================================================
 *
 * ORDEN IMPORTANTE:
 *
 * 1. notFoundMiddleware
 * 2. errorMiddleware
 *
 * Siempre al final.
 */

/**
 * Ruta inexistente
 */

app.use(
  notFoundMiddleware
);

/**
 * Captura errores lanzados
 */

app.use(
  errorMiddleware
);

/**
 * ============================================================
 * Exportación principal
 * ============================================================
 */

module.exports = app;