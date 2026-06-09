// src/modules/auth/auth.service.js
//
// EL CORAZÓN DEL MÓDULO.
// Aquí vive toda la lógica de negocio de autenticación.
// Este archivo implementa EXACTAMENTE los requerimientos del documento.
//
// El servicio:
// - NO conoce Express (sin req, res)
// - NO escribe queries de Prisma directamente (llama al repositorio)
// - SÍ implementa las reglas del negocio: bloqueos, políticas, validaciones
//
// Esta pureza hace que el servicio sea fácilmente testeable con Jest.
import crypto from 'crypto';
import { isBefore } from 'date-fns';

import * as authRepository from './auth.repository.js';
import { hashPassword, comparePassword } from '../../utils/bcrypt.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { validatePasswordPolicy, isPasswordNew } from '../../utils/password-validator.js';
import { registrarAuditoria } from '../../middlewares/audit.js';
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
  AccountLockedError,
} from '../../utils/errors.js';
import { env } from '../../config/environment.js';
import { logger } from '../../logger/index.js';
import { is } from 'zod/v4/locales';

// ──────────────────────────────────────────────
// REGISTRO DEL ADMINISTRADOR INICIAL
// ──────────────────────────────────────────────

/**
 * Crea el usuario Administrador inicial del sistema.
 * Solo puede ejecutarse UNA VEZ - Si ya existe un damin, falla.
 * 
 */
export const registrarAdmin = async ({ nombreCompleto, nombreUsuario, correo, contrasena }) => {

  // 1. Verificar que no existe ningún rol administrador aún
  const cualquierAdmin = await authRepository.buscarRolAdmin();
  if (cualquierAdmin) {
    throw new ConflictError(
      'Ya existe un administrador en el sistema. El registro inicial solo puede realizarse una vez.'
    );
  }

  // 2. Verificar disponibilidad de correo y nombre de usuario
  const usuarioExistente = await authRepository.existeUsuario(correo, nombreUsuario);
  if (usuarioExistente) {
    const campo = usuarioExistente.correo === correo
      ? 'correo electrónico'
      : 'nombre de usuario';
    throw new ConflictError(`El ${campo} ya está en uso.`);
  }

  // 3. Validar política de contraseña
  // CORRECCIÓN: pasamos el array de errores detallados al ValidationError
  const politica = validatePasswordPolicy(contrasena);
  if (!politica.valid) {
    throw new ValidationError(
      'La contraseña no cumple con la política de seguridad.',
      // Convertimos el array de strings a formato {campo, mensaje}
      // para que el frontend pueda mostrar cada regla fallida
      politica.errors.map((msg) => ({
        campo: 'contrasena',
        mensaje: msg,
        codigo: 'password_policy',
      }))
    );
  }

  // 4. Hashear la contraseña
  const passwordHash = await hashPassword(contrasena);

  // 5. Crear usuario y rol en transacción
  const usuario = await authRepository.createAdminUsuario({
    nombreCompleto,
    nombreUsuario,
    correo,
    passwordHash,
  });

  // 6. Auditoría
  await registrarAuditoria({
    accion: 'REGISTRO_ADMIN_INICIAL',
    usuarioId: usuario.id,
    entidad: 'Usuario',
    entidadId: usuario.id,
    detalle: { correo, nombreUsuario },
  });

  logger.info('✅ Administrador inicial registrado', { nombreUsuario, correo });

  const { passwordHash: _, ...usuarioSinPassword } = usuario;
  return usuarioSinPassword;
};

// ──────────────────────────────────────────────
// LOGIN
// ──────────────────────────────────────────────

/**
 * Proceso completo de inicio de sesión
 * Implementa todos los requerimientos
 */
export const login = async ({identificador,contrasena, ip, userAgent}) => {
    // 1. Buscar usuario por correo o nombre de usuario
    const usuario = await authRepository.findUsuarioByIdentificador(identificador);
    // IMPORTANTE: Si el usuario no existe, No revelamos eso.
    //Decimos "credenciales inválidas " - no "usuario no encontrado".
    //Esto previene la enumeración de usuarios.
    if(!usuario){
        logger.warn('Intento d elogin con usuario inexistente', {identificador, ip});
        throw new AuthenticationError('Credenciales inválidas. Verifica tu usuario y contraseña');
    }

    //2. Verificar si la cuenta está bloqueada PERMANENTEMENTE
    if(usuario.bloqueadoPermanente){
        await registrarAuditoria({
            accion:'LOGIN_BLOQUEADO_PERMANENTE',
            usauarioId: usuario.id,
            ip,
            userAgent,
        });
        throw new AccountLockedError(
            'Tu cuenta está bloqueada permanentemente. Contacta al administrador del sistema.'
        );
    }

    //3. Verificar si la cuenta está bloqueada TEMPORALMENTE
    if(usuario.bloqueadoHasta && isBefore(new Date(), new Date(usuario.bloqueadoHasta))){
        const minutosRestantes = Math.ceil(
            (new Date (usuario.bloqueadoHasta)- new Date())/(1000*60)
        );
        await registrarAuditoria({
            accion: 'LOGIN_BLOQUEADO_TEMPORAL',
            usuarioId: usuario.id,
            ip,
            userAgent,
        });
        throw new AccountLockedError(
            `Cuenta bloqueada temporalmente. Intenta de nuevo en ${minutosRestantes} minuto(s).`,
            minutosRestantes
        );
    }

    //4. Verificar que el usuario está activo
    if(usuario.estado !== 'ACTIVO'){
        throw new AuthenticationError('Tu cuenta está desactivada. Contacta al administrador del sistema.'  );
    }

    // 5. Verificar la contraseña
    const contrasenaCorrecta = await comparePassword(contrasena, usuario.passwordHash);
    if(!contrasenaCorrecta){
        //Incrementar intentos fallidos y aplciar bloqueo si corresponde
        const usuarioActualizado = await authRepository.incrementarIntentosFallidos(
            usuario.id,
            usuario.intentosFallidos
        );

        // verificar si ahora tiene bloqueo permanente
        await authRepository.verificarBloqueosPermanentes(
            usuario.id,
            usuarioActualizado.bloqueosTemporales
        );

        await registrarAuditoria({
            accion: 'LOGIN_FALLIDO',
            usuarioId: usuario.id,
            ip,
            userAgent,
            detalle: {intentosFallidos: usuarioActualizado.intentosFallidos},
        });

        logger.warn('Intento de login fallido', {
            usuarioId: usuario.id,
            intentos: usuarioActualizado.intentosFallidos,
            ip,
        });
        throw new AuthenticationError('Credenciales inválidas. Verifica tu usuario y contraseña.');
    }

    // 6. Login exitoso — resetear contadores
    await authRepository.resetearIntentosFallidos(usuario.id);

    // 7. Generar tokens JWT
    const accessToken = signAccessToken({
        userId: usuario.id,
        rolId: usuario.rolId,
        rolNombre: usuario.rol.nombre,
    });
    const refreshToken = signRefreshToken(usuario.id);

    // 8. Registrar en auditoría
    await registrarAuditoria({
        accion: 'LOGIN_EXITOSO',
        usuarioId: usuario.id,
        entidad: 'Usuario',
        entidadId: usuario.id,
        ip,
        userAgent,
    });
    logger.info('Login exitoso', { usuarioId: usuario.id, ip });

    // 9. Construir respuesta sin datos sensibles
    const { passwordHash, historialContrasenas, ...usuarioSeguro } = usuario;

     return {
        accessToken,
        refreshToken,
        expiresIn: env.JWT_EXPIRES_IN,
        usuario: usuarioSeguro,
        requiereCambioClave: usuario.requiereCambioClave,
    };
};

// ──────────────────────────────────────────────
// LOGOUT
// ──────────────────────────────────────────────

/**
 * Registra el cierre de sesión del usuario.
 *
 * Nota técnica sobre JWT y logout:
 * Los JWT son stateless — una vez emitidos, son válidos hasta que expiran,
 * independientemente del logout. Para un logout "real" necesitaríamos una
 * blocklist (lista negra) de tokens en Redis.
 *
 * Para este POS, el logout registra el evento en auditoría y el frontend
 * elimina el token localmente. En una fase futura, se puede añadir Redis
 * para invalidación real de tokens.
 */
export const logout =async ({usuarioId, ip, userAgent})=>{
    await registrarAuditoria({
        accion:'LOGOUT',
        usuarioId,
        entidad:'Usuario',
        entidadId:usuarioId,
        ip,
        userAgent,
    });
    logger.info('Logout resgistrado',{usuarioId, ip});

    return {message:'Sesión cerrada correctamente.'};
};

// ──────────────────────────────────────────────
// RESTABLECIMIENTO DE CONTRASEÑA
// ──────────────────────────────────────────────
/**
 * Inicia el proceso de restablecimiento de contraseña.
 * Genera un token único, lo guarda en BD y "lo envía por correo".
 *
 * NOTA: En esta versión retornamos el token directamente en la respuesta
 * para desarrollo. En producción, se enviaría por correo con nodemailer.
 */

export const solicitarRestablecimiento = async ({correo, ip})=>{
    //Buscar el usuario - si no existe, No revelar que no existe
    //(Previene enumeración de correos registrados)
    const usuario = await authRepository.findUsuarioByIdentificador(correo);

    if(!usuario){
        //Respondemos igual que si existeiera - seguridad por oscuridad
        logger.warn('Solicitud de restablecimiento para correo inexistente', {correo, ip});
        return{
            message:'Si el correo está registrado, recibirás las instrucciones en breve.'
        };
    }

    if(usuario.bloqueadoPermanente){
        throw new AuthenticationError(
            'Tu cuenta está bloqueada. Contacta al administrador para desbloquearla primero.'
        );
    }

    // Generar token criptográficamente seguro
    //crypto.randomBytes(32) genera 32 bytes aleatorios -> 64 caracteres hex
    const token = crypto.randomBytes(32).toString('hex');

    //Guardar el token en Bd (Expira en 30  minutos)
    await authRepository.createTokenRestablecimiento(usuario.id, token, ip);

    //Registrar auditoria
    await registrarAuditoria({
        accion:'SOLICITUD_RESTABLECIMIENTO_CONTRASENA',
        usuarioId: usuario.id,
        ip,
        detalle:{correo},
    });

    logger.info('Token de restablecimiento geenrado', {usuarioId: usuario.id});

    //RODO: en producción enviar por correo con nodemailer
    //Por ahora retornamos el token en la respuesta 
    return{
        message:'Si el correo está registrado, recibiras las instrucciones en breve.',
        // ⚠️ SOLO PARA DESARROLLO — remover en producción
    ...(env.IS_DEVELOPMENT && { token, devNote: 'Token visible solo en modo development' }),
    }
};

/**
 * Completa el restablecimiento de contraseña usando el token.
 */
export const restablecerContrasena = async ({ token, nuevaContrasena, ip }) => {

  // 1. Buscar el token válido en la BD
  const tokenRegistro = await authRepository.findTokenRestablecimiento(token);

  if (!tokenRegistro) {
    throw new AuthenticationError(
      'El enlace de restablecimiento es inválido o ha expirado. Solicita uno nuevo.'
    );
  }

  const usuario = tokenRegistro.usuario;

  // 2. Validar política de contraseña
  const politica = validatePasswordPolicy(nuevaContrasena);
  if (!politica.valid) {
    throw new ValidationError(
      'La contraseña no cumple con la política de seguridad.',
      politica.errors.map((msg) => ({
        campo: 'nuevaContrasena',
        mensaje: msg,
        codigo: 'password_policy',
      }))
    );
  }

  // 3. Verificar que no repite las últimas 3 contraseñas
  const esNueva = await isPasswordNew(nuevaContrasena, usuario.historialContrasenas);
  if (!esNueva) {
    throw new ValidationError(
      'La nueva contraseña no puede ser igual a ninguna de las últimas 3 contraseñas utilizadas.',
      [{ campo: 'nuevaContrasena', mensaje: 'Contraseña ya utilizada recientemente.', codigo: 'password_reuse' }]
    );
  }

  // 4. Hashear y actualizar
  const passwordHash = await hashPassword(nuevaContrasena);

  // ✅ CLAVE: pasar tokenRegistro.id (string) no tokenRegistro (objeto)
  await authRepository.actualizarContrasena(usuario.id, passwordHash, tokenRegistro.id);

  // 5. Auditoría
  await registrarAuditoria({
    accion: 'CONTRASENA_RESTABLECIDA',
    usuarioId: usuario.id,
    ip,
  });

  logger.info('Contraseña restablecida exitosamente', { usuarioId: usuario.id });

  return { message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.' };
};

// ──────────────────────────────────────────────
// CAMBIO DE CONTRASEÑA (usuario autenticado)
// ──────────────────────────────────────────────

/**
 * Permite a un usuario autenticado cambiar su propia contraseña.
 * También se usa cuando el sistema obliga el cambio en el primer login.
 */

export const cambiarContrasena = async ({
  usuarioId,
  contrasenaActual,
  nuevaContrasena,
  ip,
  userAgent,
}) => {
  // 1. Obtener usuario
  const usuario = await authRepository.findUsuarioById(usuarioId);
  if (!usuario) {
    throw new NotFoundError('Usuario no encontrado.');
  }

  // 2. Verificar contraseña actual
  const esCorrecta = await comparePassword(contrasenaActual, usuario.passwordHash);
  if (!esCorrecta) {
    throw new AuthenticationError('La contraseña actual ingresada es incorrecta.');
  }

  // 3. Obtener historial desde el repositorio (sin importar prisma)
  const historial = await authRepository.findHistorialContrasenas(usuarioId);

  // 4. Validar política
  const politica = validatePasswordPolicy(nuevaContrasena);
  if (!politica.valid) {
    throw new ValidationError(
      'La contraseña no cumple con la política de seguridad.',
      politica.errors.map((msg) => ({
        campo: 'nuevaContrasena',
        mensaje: msg,
        codigo: 'password_policy',
      }))
    );
  }

  // 5. Verificar que no repite las últimas 3
  const esNueva = await isPasswordNew(nuevaContrasena, historial);
  if (!esNueva) {
    throw new ValidationError(
      'La nueva contraseña no puede ser igual a ninguna de las últimas 3 contraseñas.',
      [{ campo: 'nuevaContrasena', mensaje: 'Contraseña ya utilizada recientemente.', codigo: 'password_reuse' }]
    );
  }

  // 6. Hashear y actualizar
  const passwordHash = await hashPassword(nuevaContrasena);
  await authRepository.actualizarContrasena(usuarioId, passwordHash);

  // 7. Auditoría
  await registrarAuditoria({
    accion: 'CAMBIO_CONTRASENA',
    usuarioId,
    ip,
    userAgent,
  });

  logger.info('Contraseña cambiada exitosamente', { usuarioId });

  return { message: 'Contraseña actualizada exitosamente.' };
};

// ──────────────────────────────────────────────
// REFRESH TOKEN
// ──────────────────────────────────────────────

/**
 * Renueva el access token usando un refresh token válido.
 */
export const refreshToken = async ({token})=>{
    //1. Verificar el refresh token
    const decoded = verifyRefreshToken(token);

    // 2. Verificar que el usuario aún existe  y está activo
    const usuario = await authRepository.findUsuarioById(decode.sub);

    if(!usuario || usuario.estado !== 'ACTIVO'){
        throw new AuthenticationError('No se puede renovar la sesión. Usuario inactivo.');
    }

    // 3. Generar nuevo access token
    const accessToken = signAccessToken({
        userId: usuario.id,
        rolId: usuario.rolId,
        rolNombre: usuario.rol.nombre,
    });

    return{
        accessToken, expiresIn:env.JWT_EXPIRES_IN,
    };
        
    
};

// ──────────────────────────────────────────────
// MI PERFIL
// ──────────────────────────────────────────────

/**
 * Retorna el perfil del usuario autenticado sin datos sensibles.
 */

export const miPerfil = async(usuarioId)=>{
    const usuario = await authRepository.findUsuarioById(usuarioId);
    if(!usuario){
        throw new NotFoundError('Usuario no encontrado.');
    }

    const {passwordHash, ...miPerfil}= usuario;
    return miPerfil;
};
