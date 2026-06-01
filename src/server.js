// src/server.js
//
// Este archivo hace UNA sola cosa: arrancar el servidor HTTP.
// La separación de app.js (configuración) y server.js (arranque)
// permite importar app en los tests sin iniciar el servidor real.

import {app} from './app.js';
import {env} from './config/environment.js';
import {prisma} from './config/database.js';
import {logger} from './logger/index.js';

const startServer = async()=>{
    try{
        //1. Verificar conexión a la base de datos antes de arrancar
        await prisma.$connect();
        logger.info('✅ Conexión a la base de datos establecid');

        // 2.Arrancar el servidor HTTP
        const server =app.listen(env.PORT, ()=>{
            logger.info(`🚀 Servidor POS arrancado`, {
                port:env.PORT,
                enviroment: env.NODE_ENV,
                apiUrl:`http://localhost:${env.PORT}/api/${env.API_VERSION}`,
                health: `http://localhost:${env.PORT}/api/health`,
            });
        });

        // 3. Manejo graceful de cierre del servidor
        // Cuando el proceso recibe SIGTERM (kill) o SIGINT (Ctrl+C),
        // cerramos las conexiones limpiamente en lugar de cortar abruptamente.
        const gracefulShutdown =async (signal)=>{
           logger.info(`⚠️  Señal ${signal} recibida. Iniciando cierre graceful...`);
           server.close(async ()=>{
            logger.info('🔌 Servidor HTTP cerrado');

            await prisma.$disconnect();
            logger.info('🗄️  Conexión a BD cerrada');

            logger.info('✅ Proceso terminado correctamente');
            process.exit(0);
           });

           //Si el cierre tarda más de 10 segundos, forzar salida
           setTimeout(()=>{
                logger.error('❌ Cierre graceful excedió el tiempo límite. Forzando salida.');
                process.exit(1);
           },10000);
        };

        process.on('SIGTERM', ()=> gracefulShutdown('SIGTERM'));
        process.on('SIGINT', ()=> gracefulShutdown('SIGINT'));

        //4.Capturar excepciones no amnejadas (el ultimo recurso)
        process.on('unhandledRejection', (reason, promise)=>{
            logger.error('🚨 Promesa rechazada sin manejar', { reason, promise });
        });

         process.on('uncaughtException', (error) => {
            logger.error('🚨 Excepción no capturada', { error });
            process.exit(1);
        });
    } catch (error){
        logger.error('❌ Error al arrancar el servidor', { error });
        process.exit(1);
    }
};

startServer();