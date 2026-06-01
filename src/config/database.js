// src/config/database.js
//
// El PATRÓN SINGLETON es crítico aquí.
// Prisma Client abre un pool de conexiones a la base de datos.
// Si creamos múltiples instancias (una por archivo), abrimos múltiples pools,
// lo cual agota las conexiones disponibles. Con el singleton, toda la app
// comparte UNA sola instancia.
//
// En desarrollo, Hot Reload (nodemon) recarga módulos pero no reinicia el proceso,
// lo que puede crear múltiples instancias. El truco de globalThis resuelve esto.

import {PrismaClient}  from '@prisma/client';
import {env} from './environment.js';
import {logger} from '../logger/index.js';

//En desarrollo: reutilizamos la instancia guardada en globalThis
//En producción: siempre creamos una nueva instancia
const createPrismaClient=()=>{
    return new PrismaClient({
        log: env.IS_DEVELOPMENT ?
        [
            {emit:'event',level:'query'}, //Log de todas las queries SQL
            {emit:'event',level:'warn'},
            {emit:'event',level:'error'},
        ]:
        [
            {emit:'event',level:'warn'},
            {emit:'event',level:'error'},
        ],
    });
}

//Singleton: una sola instancia en toda la aplicación
const prisma = globalThis.__prisma ?? createPrismaClient();

// En desarrollo, guardamos en globalThis para sobrevivir hot reloads
if(env.IS_DEVELOPMENT){
    globalThis.__prisma=prisma;
}

//Log de queries SQL en desarrollo (para ver qué está haciendo Prisma)
if(env.IS_DEVELOPMENT){
    prisma.$on('query', (event)=>{
        logger.debug('Prisma Query',{
            query:event.query,
            params:event.params,
            duration: `${event.duration}ms`,
        });
    });
}

prisma.$on('warn', (event)=>{
    logger.warn('Prisma Warning', {message: event.message});
});

prisma.$on('error', (event)=>{
    logger.error('Prisma Error', {message: event.message});
});

export {prisma};