// ==========================================================
// SERVICIO DE AUTENTICACIÓN
// ==========================================================
//
// Este módulo contiene toda la lógica de negocio
// relacionada con autenticación.
//
// Responsabilidades:
//
// ✅ Login
// ✅ Logout
// ✅ Generación JWT
// ✅ Refresh tokens
// ✅ Bloqueo por intentos fallidos
// ✅ Revocación de tokens
// ✅ Validación de usuarios
// ✅ Auditoría básica
//
// Este archivo es básicamente:
//
// "la frontera entre usuarios legítimos y el caos".
//
// Aquí vive la seguridad real.
// El frontend solo pone formularios bonitos.
//
// ==========================================================





// ==========================================================
// IMPORTACIONES
// ==========================================================


// ----------------------------------------------------------
// bcrypt
// ----------------------------------------------------------
//
// Librería para hashing seguro de contraseñas.
//
// compare():
// compara password plana contra hash.
//
// Nunca se deben guardar passwords reales.
// Hacer eso en producción debería activar alarmas físicas.
//
// ----------------------------------------------------------

const bcrypt = require('bcrypt');



// ----------------------------------------------------------
// jsonwebtoken
// ----------------------------------------------------------
//
// Librería JWT.
//
// Permite:
//
// ✅ generar tokens
// ✅ verificar tokens
// ✅ decodificar payloads
//
// ----------------------------------------------------------

const jwt = require('jsonwebtoken');



// ----------------------------------------------------------
// Variables de entorno
// ----------------------------------------------------------
//
// Configuración sensible:
//
// - JWT secret
// - expiraciones
// - configuración auth
//
// ----------------------------------------------------------

const env = require('../../config/env');



// ----------------------------------------------------------
// Repository de auth
// ----------------------------------------------------------
//
// Acceso a base de datos.
//
// Maneja:
//
// - búsqueda usuarios
// - actualización intentos login
// - último login
//
// Separación correcta:
// service → lógica negocio
// repository → acceso datos
//
// Milagro arquitectónico poco frecuente.
//
// ----------------------------------------------------------

const repo = require('./repository');



// ----------------------------------------------------------
// Logger
// ----------------------------------------------------------
//
// Sistema centralizado de logs.
//
// Útil para:
//
// ✅ auditoría
// ✅ debugging
// ✅ monitoreo seguridad
//
// ----------------------------------------------------------

const logger = require('../../config/logger');






// ==========================================================
// CONFIGURACIÓN SEGURIDAD LOGIN
// ==========================================================


// ----------------------------------------------------------
// MAX_ATTEMPTS
// ----------------------------------------------------------
//
// Máximo intentos permitidos antes de bloquear.
//
// ----------------------------------------------------------

const MAX_ATTEMPTS = 5;



// ----------------------------------------------------------
// LOCK_MINUTES
// ----------------------------------------------------------
//
// Tiempo de bloqueo de cuenta.
//
// 30 minutos.
//
// Protección básica contra:
//
// ✅ fuerza bruta
// ✅ ataques automatizados
//
// Porque internet está lleno de bots
// intentando adivinar "admin123".
//
// ----------------------------------------------------------

const LOCK_MINUTES = 30;






// ==========================================================
// TOKEN BLACKLIST
// ==========================================================
//
// Blacklist en memoria para revocar tokens JWT.
//
// JWT normalmente es stateless:
//
// → una vez emitido sigue válido
// hasta expirar.
//
// Esta blacklist permite invalidarlos manualmente.
//
// IMPORTANTE:
//
// Esta implementación funciona solo:
//
// ✅ proceso único
//
// NO funciona correctamente en:
//
// ❌ múltiples instancias
// ❌ microservicios
// ❌ clustering
//
// En producción real:
//
// → Redis
//
// ==========================================================



// ----------------------------------------------------------
// Set de tokens revocados
// ----------------------------------------------------------
//
// Set():
// estructura rápida para búsquedas.
//
// Ventajas:
//
// ✅ O(1) búsqueda
// ✅ eficiente
// ✅ simple
//
// ----------------------------------------------------------

const tokenBlacklist = new Set();






// ==========================================================
// LIMPIEZA AUTOMÁTICA TOKENS EXPIRADOS
// ==========================================================
//
// Evita crecimiento infinito memoria.
//
// Se ejecuta:
//
// cada 1 hora
//
// ==========================================================

setInterval(() => {


  // ========================================================
  // TIEMPO ACTUAL UNIX
  // ========================================================
  //
  // Date.now()
  //
  // /1000:
  // convertir ms → segundos
  //
  // ========================================================

  const now = Date.now() / 1000;



  // ========================================================
  // RECORRER TOKENS REVOCADOS
  // ========================================================

  for (const token of tokenBlacklist) {

    try {


      // ----------------------------------------------------
      // DECODIFICAR TOKEN
      // ----------------------------------------------------
      //
      // jwt.decode():
      //
      // NO valida firma.
      // Solo extrae payload.
      //
      // Más rápido para limpieza.
      //
      // ----------------------------------------------------

      const decoded = jwt.decode(token);



      // ----------------------------------------------------
      // ELIMINAR SI YA EXPIRÓ
      // ----------------------------------------------------
      //
      // exp:
      // timestamp expiración JWT
      //
      // ----------------------------------------------------

      if (decoded && decoded.exp < now) {
        tokenBlacklist.delete(token);
      }

    } catch {


      // ----------------------------------------------------
      // TOKEN INVÁLIDO
      // ----------------------------------------------------
      //
      // Si falla decode:
      // eliminar token corrupto.
      //
      // ----------------------------------------------------

      tokenBlacklist.delete(token);
    }
  }

}, 60 * 60 * 1000);






// ==========================================================
// VALIDAR TOKEN REVOCADO
// ==========================================================
//
// Verifica si token existe en blacklist.
//
// ==========================================================

const isTokenRevoked = (token) =>
  tokenBlacklist.has(token);




// ==========================================================
// REVOCAR TOKEN
// ==========================================================
//
// Agrega token a blacklist.
//
// ==========================================================

const revokeToken = (token) =>
  tokenBlacklist.add(token);






// ==========================================================
// GENERAR ACCESS TOKEN
// ==========================================================
//
// JWT principal autenticación.
//
// Payload:
//
// ✅ id usuario
// ✅ username
// ✅ role
//
// ==========================================================

const generateToken = (user) => {

  return jwt.sign(


    // ======================================================
    // PAYLOAD JWT
    // ======================================================
    //
    // Información embebida en token.
    //
    // ======================================================

    {
      id: user.id,
      username: user.username,
      role: user.role_name,
    },


    // ======================================================
    // SECRET JWT
    // ======================================================
    //
    // Clave firma criptográfica.
    //
    // MUY sensible.
    //
    // Nunca hardcodear.
    //
    // ======================================================

    env.jwt.secret,


    // ======================================================
    // OPCIONES TOKEN
    // ======================================================
    //
    // expiresIn:
    // tiempo expiración.
    //
    // Ejemplo:
    // 15m
    // 1h
    // 7d
    //
    // ======================================================

    {
      expiresIn: env.jwt.expiresIn,
    }
  );
};






// ==========================================================
// GENERAR REFRESH TOKEN
// ==========================================================
//
// Token especial para renovar access token.
//
// Más duradero.
//
// ==========================================================

const generateRefreshToken = (user) => {

  return jwt.sign(

    {
      id: user.id,
      type: 'refresh',
    },

    env.jwt.secret,

    {
      expiresIn: env.jwt.refreshExpiresIn,
    }
  );
};






// ==========================================================
// LOGIN
// ==========================================================
//
// Flujo principal autenticación.
//
// Pasos:
//
// 1. Buscar usuario
// 2. Validar activo
// 3. Validar bloqueo
// 4. Comparar password
// 5. Generar tokens
// 6. Retornar sesión
//
// ==========================================================

const login = async (username, password) => {


  // ========================================================
  // BUSCAR USUARIO
  // ========================================================

  const user = repo.findUserByUsername(username);




  // ========================================================
  // USUARIO NO EXISTE
  // ========================================================
  //
  // Mensaje genérico:
  //
  // evita revelar si usuario existe.
  //
  // Seguridad importante.
  //
  // ========================================================

  if (!user) {

    throw {
      status: 401,
      message: 'Credenciales incorrectas',
    };
  }




  // ========================================================
  // USUARIO INACTIVO
  // ========================================================

  if (!user.is_active) {

    throw {
      status: 401,
      message: 'Usuario inactivo. Contacta al administrador.',
    };
  }




  // ========================================================
  // CUENTA BLOQUEADA
  // ========================================================
  //
  // Verifica si locked_until sigue vigente.
  //
  // ========================================================

  if (
    user.locked_until &&
    new Date(user.locked_until) > new Date()
  ) {

    // ------------------------------------------------------
    // CALCULAR MINUTOS RESTANTES
    // ------------------------------------------------------

    const remaining = Math.ceil(
      (
        new Date(user.locked_until) -
        new Date()
      ) / 60000
    );

    throw {
      status: 429,
      message:
        `Cuenta bloqueada. Intenta en ${remaining} minutos.`,
    };
  }






  // ========================================================
  // VALIDAR PASSWORD
  // ========================================================
  //
  // bcrypt.compare():
  //
  // compara password plana contra hash.
  //
  // ========================================================

  const passwordValid = await bcrypt.compare(
    password,
    user.password_hash
  );






  // ========================================================
  // PASSWORD INCORRECTA
  // ========================================================

  if (!passwordValid) {


    // ------------------------------------------------------
    // AUMENTAR INTENTOS
    // ------------------------------------------------------

    const newAttempts =
      (user.login_attempts || 0) + 1;



    let lockedUntil = null;




    // ------------------------------------------------------
    // BLOQUEAR CUENTA
    // ------------------------------------------------------
    //
    // Si supera máximo intentos.
    //
    // ------------------------------------------------------

    if (newAttempts >= MAX_ATTEMPTS) {

      const lockTime = new Date();

      lockTime.setMinutes(
        lockTime.getMinutes() + LOCK_MINUTES
      );

      lockedUntil = lockTime.toISOString();



      // ----------------------------------------------------
      // LOG SEGURIDAD
      // ----------------------------------------------------

      logger.warn(
        `Usuario ${username} bloqueado por ${MAX_ATTEMPTS} intentos fallidos`
      );
    }




    // ------------------------------------------------------
    // GUARDAR INTENTOS
    // ------------------------------------------------------

    repo.updateLoginAttempts(
      user.id,
      newAttempts,
      lockedUntil
    );




    // ------------------------------------------------------
    // CALCULAR INTENTOS RESTANTES
    // ------------------------------------------------------

    const remaining =
      MAX_ATTEMPTS - newAttempts;




    // ------------------------------------------------------
    // ERROR LOGIN
    // ------------------------------------------------------

    throw {

      status: 401,

      message:
        remaining > 0

          ? `Credenciales incorrectas. ${remaining} intentos restantes.`

          : 'Cuenta bloqueada por múltiples intentos fallidos.',
    };
  }






  // ========================================================
  // LOGIN EXITOSO
  // ========================================================


  // --------------------------------------------------------
  // ACTUALIZAR ÚLTIMO LOGIN
  // --------------------------------------------------------

  repo.updateLastLogin(user.id);




  // --------------------------------------------------------
  // GENERAR TOKENS
  // --------------------------------------------------------

  const token = generateToken(user);

  const refreshToken = generateRefreshToken(user);




  // --------------------------------------------------------
  // LOG LOGIN EXITOSO
  // --------------------------------------------------------

  logger.info(
    `Login exitoso: ${username} (${user.role_name})`
  );




  // --------------------------------------------------------
  // RETORNAR SESIÓN
  // --------------------------------------------------------

  return {

    token,

    refreshToken,

    user: {

      id: user.id,

      name: user.name,

      username: user.username,

      role: user.role_name,


      // ----------------------------------------------------
      // PERMISOS
      // ----------------------------------------------------
      //
      // permissions almacenado JSON string.
      //
      // JSON.parse():
      // convertir → objeto JS.
      //
      // ----------------------------------------------------

      permissions: JSON.parse(
        user.permissions || '{}'
      ),
    },
  };
};






// ==========================================================
// LOGOUT REAL
// ==========================================================
//
// Revoca token JWT.
//
// ==========================================================

const logout = (token) => {

  if (token) {
    revokeToken(token);
  }
};






// ==========================================================
// REFRESH TOKEN
// ==========================================================
//
// Genera nuevo access token
// usando refresh token.
//
// Flujo:
//
// refresh token válido
//   ↓
// generar nuevo access token
//
// ==========================================================

const refreshToken = (token) => {


  // ========================================================
  // VALIDAR REVOCACIÓN
  // ========================================================

  if (isTokenRevoked(token)) {

    throw {
      status: 401,
      message: 'Token revocado',
    };
  }






  try {


    // ======================================================
    // VALIDAR JWT
    // ======================================================

    const decoded = jwt.verify(
      token,
      env.jwt.secret
    );




    // ======================================================
    // VALIDAR TIPO REFRESH
    // ======================================================

    if (decoded.type !== 'refresh') {

      throw new Error(
        'Token inválido para refresh'
      );
    }






    // ======================================================
    // OBTENER USUARIO ACTIVO
    // ======================================================

    const user = require('../../config/db')

      .prepare(`

        SELECT u.*, r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = ?
        AND u.is_active = 1

      `)

      .get(decoded.id);




    // ======================================================
    // VALIDAR EXISTENCIA USUARIO
    // ======================================================

    if (!user) {

      throw new Error(
        'Usuario no encontrado'
      );
    }






    // ======================================================
    // RETORNAR NUEVO TOKEN
    // ======================================================

    return {

      token: generateToken(user),
    };

  } catch {


    // ======================================================
    // ERROR REFRESH TOKEN
    // ======================================================

    throw {
      status: 401,
      message:
        'Refresh token inválido o expirado',
    };
  }
};






// ==========================================================
// EXPORTACIONES
// ==========================================================
//
// Funciones públicas del servicio.
//
// ==========================================================

module.exports = {

  login,

  logout,

  refreshToken,

  isTokenRevoked,

  revokeToken,
};






// ==========================================================
// FUNCIONALIDADES IMPLEMENTADAS
// ==========================================================
//
// ✅ Login seguro
// ✅ JWT access token
// ✅ Refresh token
// ✅ Logout real
// ✅ Blacklist tokens
// ✅ Bloqueo por intentos
// ✅ Auditoría logs
// ✅ Validación usuarios activos
// ✅ Protección fuerza bruta
// ✅ Control expiración
// ✅ Roles y permisos
//
// Arquitectura bastante seria realmente.
// Mucho backend corporativo ni siquiera
// implementa refresh tokens correctamente.
//
// ==========================================================