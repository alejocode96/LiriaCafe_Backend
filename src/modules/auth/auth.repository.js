// src/modules/auth/auth.repository.js
//
// ¿QUÉ HACE EL REPOSITORIO?
// Es la única capa que habla con la base de datos.
// El servicio NUNCA escribe SQL ni Prisma directamente — llama al repositorio.
//
// ¿Por qué esta separación?
// Si mañana cambiamos de Prisma a otro ORM, o de SQLite a MongoDB,
// solo modificamos el repositorio. El servicio (la lógica de negocio) no cambia.
//
// CONVENCIÓN: Los métodos del repositorio son verbos descriptivos de BD:
// findByCorreo, findByNombreUsuario, createUsuario, updateContrasena, etc.
// NO contienen lógica de negocio — solo queries.

import { prisma } from '../../config/database.js';
import { addMinutes } from 'date-fns';
import { env } from '../../config/environment.js';




// ──────────────────────────────────────────────
// CONSULTAS DE USUARIO
// ──────────────────────────────────────────────

/**
 *  Busca un usuario por correo o nombre de usuario.
 * Carga el rol e incluye el hash de contraseña (solo para auth)
 */
export const findUsuarioByIdentificador =async (identificador)=>{
    return prisma.usuario.findFirst({
        where:{
            OR:[
                {correo:identificador},
                {nombreUsuario: identificador},
            ],
        },
        include:{
            rol:{
                include:{permisos:true},
            },
            historialContrasenas:{
                orderBy: { createdAt: 'desc'},
                take: 3, //solo las últimas 3 para validar reutilización
            },
            
        },
    });
};

/**
 *  Busca un usuario por su ID
 *  Útil para verificar estado actual al renovar token.
 */
export const findUsuarioById= async(id)=>{
    return prisma.usuario.findUnique({
        where:{id},
        include:{
            rol:{
                include:{permisos:true},
            },
        },
    });
};

/**
 * Verifica si ya existe un usuario con ese correo o nombre de usuario.
 * Usado en el registro para evitar duplicados.
 */
export const existeUsuario = async (correo, nombreUsuario) => {
  const usuario = await prisma.usuario.findFirst({
    where: {
      OR: [{ correo }, { nombreUsuario }],
    },
    select: { id: true, correo: true, nombreUsuario: true },
  });
  return usuario;
};

// ──────────────────────────────────────────────
// CREACIÓN
// ──────────────────────────────────────────────

/**
 * Crea el usuario Administrador incial junto con su rol.
 * Se ejecuta en el seed y en el endpoint register.admin
 */

export const createAdminUsuario =async({nombreCompleto, nombreUsuario, correo, passwordHash})=>{
    //Usamos una transacción: si algo falla, se revierten AMBAS operaciones.
    //Nunca queremos un rol sin usuario o un usrio sin rol.
    return prisma.$transaction(async (tx)=>{
        //1. Crear el rol Administrador
        const rolAdmin= await tx.rol.create({
            data:{
                nombre:'ADMINISTRADOR',
                descripcion:'Rol con acceso total al sistema. Predefinido e inmutable.',
                esAdmin: true,
                estado:'ACTIVO',
            },
        });

        //2. crear el usuario admin vinculado al rol
        const usuario = await tx.usuario.create({
            data:{
                nombreCompleto,
                nombreUsuario,
                correo,
                passwordHash,
                estado:'ACTIVO',
                requiereCambioClave:false, //El admin inicial no requiere cambio
                rolId: rolAdmin.id,
            },
            include:{
                rol:true,
            },
        });

        //3. Guardar la contraseña en el historial(para la regla no repetición)
        await tx.historialContrasena.create({
            data:{
                usuarioId:usuario.id,
                passwordHash,
            },
        });
        return usuario;
    });
    
};

// ──────────────────────────────────────────────
// ACTUALIZACIONES DE SEGURIDAD
// ──────────────────────────────────────────────
/**
 * Incrementa el contador de intentos fallidos.
 * Si supera el máximo, bloquea la cuenta temporalmente.
 */
export const incrementarIntentosFallidos = async (usuarioId, intentosActuales)=>{
    const nuevosIntentos = intentosActuales+1;
    const data ={intentosFallidos: nuevosIntentos};

    // ¿Superó el máximo? -> bloquear temporalmente
    if(nuevosIntentos >= env.MAX_LOGIN_ATTEMPTS){
        data.bloqueadoHasta=addMinutes(new Date(), env.LOCK_TIME_MINUTES);
        data.intentosFallidos=0; //reiniciar el contador para el prósimo ciclo
        data.bloqueosTemporales ={increment:1}; //Incrementar contador de bloqueos

    }

    return prisma.usuario.update({
        where:{id:usuarioId},
        data,
    });
};

/**
 * Verifica si se alxanzó el límite de bloqueos temporales
 * y bloquea la cuenta permanentemente si es necesario
 */
export const verificarBloqueosPermanentes =async (usuarioId, bloqueosTemporales) =>{
    if(bloqueosTemporales >= env.PERMANENT_LOCK_AFTER_BLOCKS){
        await prisma.usuario.update({
            where:{id:usuarioId},
            data:{bloqueadoPermanente: true},
        });
        return true // se bloqueó permanentemente
    }
    return false;
};

/**
 * Resetea los contadores de intentos fallidos tras un login exitoso.
 * También actualiza el timestamp de último acceso
 */
export const resetearIntentosFallidos = async(usuarioId)=>{
    return prisma.usuario.update({
        where:{id:usuarioId},
        data:{
            intentosFallidos:0,
            ultimoAcceso: new Date()
        },
    });
};

// ──────────────────────────────────────────────
// RESTABLECIMIENTO DE CONTRASEÑA
// ──────────────────────────────────────────────

/**
 * crea un token de restablecimiento de contraseña.
 * El token expira en 30 minutos 
 */
export const createTokenRestablecimiento = async (usuarioId, token, ip) => {
  // Invalidar tokens previos del usuario
  await prisma.tokenRestablecimiento.updateMany({
    where: { usuarioId, usado: false },
    data: { usado: true },
  });

  // Crear el nuevo token
  return prisma.tokenRestablecimiento.create({
    data: {
      token,
      usuarioId,
      ip,
      expiresAt: addMinutes(new Date(), 30),
      usado: false,
    },
  });
};

/**
 * Busca un token de restablecimiento váñido (no usado, no expirado).
 */
export const findTokenRestablecimiento = async (token) => {
  return prisma.tokenRestablecimiento.findFirst({
    where: {
      token,
      usado: false,
      expiresAt: { gt: new Date() },
    },
    include: {
      usuario: {
        include: {
          historialContrasenas: {
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
        },
      },
    },
  });
};

/**
 * Actualiza la contraseña del usuario y registra en el historial.
 * Opera en trasnsaccion para garantizar consistencia
 */
export const actualizarContrasena = async (usuarioId, nuevoPasswordHash, invalidarToken = null) => {
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.update({
      where: { id: usuarioId },
      data: {
        passwordHash: nuevoPasswordHash,
        requiereCambioClave: false,
      },
    });

    await tx.historialContrasena.create({
      data: { usuarioId, passwordHash: nuevoPasswordHash },
    });

    const historial = await tx.historialContrasena.findMany({
      where: { usuarioId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (historial.length > 10) {
      const idsAEliminar = historial.slice(10).map((h) => h.id);
      await tx.historialContrasena.deleteMany({
        where: { id: { in: idsAEliminar } },
      });
    }

    // ✅ CORREGIDO: tokenRestablecimiento (no findTokenRestablecimiento)
    if (invalidarToken) {
      await tx.tokenRestablecimiento.update({
        where: { id: invalidarToken },
        data: { usado: true },
      });
    }

    return usuario;
  });
};


// Agregar esta función en src/modules/auth/auth.repository.js
export const buscarRolAdmin = async () => {
  return prisma.rol.findFirst({ 
    where: { esAdmin: true } 
  });
};

// Agregar esta función al final de auth.repository.js
export const findHistorialContrasenas = async (usuarioId) => {
  return prisma.historialContrasena.findMany({
    where: { usuarioId },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
};