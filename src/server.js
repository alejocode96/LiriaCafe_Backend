/**
 * ============================================================
 * Archivo: backend/src/server.js
 * Propósito:
 * Punto de entrada principal del backend LIRIACAFE POS.
 *
 * Este archivo coordina el arranque completo del sistema.
 *
 * Flujo de inicio:
 *
 * 1. Cargar variables de entorno
 * 2. Inicializar logger
 * 3. Crear/verificar schema DB
 * 4. Ejecutar seed inicial
 * 5. Iniciar jobs programados
 * 6. Levantar servidor HTTP
 * 7. Escuchar señales de apagado
 *
 * Este archivo NO contiene lógica de negocio.
 * Solo orquestación de arranque.
 *
 * Porque mezclar arranque, rutas y negocio en un solo
 * archivo suele ser una carta de amor al caos.
 * ============================================================
 */

/**
 * ============================================================
 * Configuración base
 * ============================================================
 */

const env = require('./config/env');
const logger = require('./config/logger');

/**
 * ============================================================
 * bootstrap()
 * ============================================================
 *
 * Función principal de inicio del sistema.
 *
 * Usa async porque algunas tareas requieren await:
 * - seed inicial
 * - posibles jobs futuros
 */

async function bootstrap() {
  try {
    /**
     * ========================================================
     * Banner de inicio
     * ========================================================
     */

    logger.info(
      '═══════════════════════════════════════════'
    );

    logger.info(
      '   LIRIACAFE POS - Iniciando servidor...   '
    );

    logger.info(
      '═══════════════════════════════════════════'
    );

    /**
     * ========================================================
     * 1. Crear / verificar schema DB
     * ========================================================
     *
     * Garantiza que existan tablas e índices.
     */

    const {
      createSchema,
    } = require('./database/schema');

    createSchema();

    /**
     * ========================================================
     * 2. Ejecutar seed inicial
     * ========================================================
     *
     * Inserta:
     * - roles
     * - admin
     * - categorías
     * - settings
     *
     * Debe ser idempotente.
     */

    const {
      runSeed,
    } = require('./database/seed');

    await runSeed();

    /**
     * ========================================================
     * 3. Iniciar jobs programados
     * ========================================================
     *
     * Ejemplo:
     * backups automáticos.
     */

    const {
      startBackupJob,
    } = require('./jobs/backup.job');

    startBackupJob();

    /**
     * ========================================================
     * 4. Cargar app Express
     * ========================================================
     */

    const app =
      require('./app');

    /**
     * ========================================================
     * 5. Levantar servidor HTTP
     * ========================================================
     */

    const server = app.listen(
      env.port,
      () => {
        logger.info(
          `Servidor corriendo en puerto: ${env.port}`
        );

        logger.info(
          `Entorno: ${env.nodeEnv}`
        );

        logger.info(
          `API: http://localhost:${env.port}/api/v1`
        );

        logger.info(
          `Health: http://localhost:${env.port}/health`
        );

        logger.info(
          '═══════════════════════════════════════════'
        );
      }
    );

    /**
     * ========================================================
     * shutdown(signal)
     * ========================================================
     *
     * Cierre controlado del servidor.
     *
     * Evita cortar conexiones abruptamente.
     */

    const shutdown = (
      signal
    ) => {
      logger.info(
        `Señal ${signal} recibida. Cerrando servidor...`
      );

      server.close(() => {
        logger.info(
          'Servidor cerrado correctamente'
        );

        process.exit(0);
      });
    };

    /**
     * ========================================================
     * Señales del sistema operativo
     * ========================================================
     *
     * SIGINT  = Ctrl + C
     * SIGTERM = Docker / Linux / Hosting
     */

    process.on(
      'SIGTERM',
      () => shutdown('SIGTERM')
    );

    process.on(
      'SIGINT',
      () => shutdown('SIGINT')
    );

    /**
     * ========================================================
     * Errores no capturados
     * ========================================================
     *
     * uncaughtException:
     * errores síncronos no manejados
     */

    process.on(
      'uncaughtException',
      (err) => {
        logger.error(
          'Error no capturado:',
          err
        );

        process.exit(1);
      }
    );

    /**
     * ========================================================
     * Promesas rechazadas sin catch
     * ========================================================
     */

    process.on(
      'unhandledRejection',
      (reason) => {
        logger.error(
          'Promise rechazada sin manejar:',
          reason
        );

        process.exit(1);
      }
    );

  } catch (error) {
    /**
     * ========================================================
     * Error fatal durante arranque
     * ========================================================
     */

    logger.error(
      'Error fatal al iniciar:',
      error
    );

    process.exit(1);
  }
}

/**
 * ============================================================
 * Ejecutar aplicación
 * ============================================================
 */

bootstrap();