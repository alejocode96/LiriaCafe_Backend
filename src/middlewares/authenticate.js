// src/middlewares/authenticate.js
//
// ¿QUÉ HACE ESTE MIDDLEWARE?
// Protege todos los endpoints que requieren inicio de sesión.
// Se coloca ANTES del controlador en la ruta.
//
// Flujo:
// 1. Extrae el token del header "Authorization: Bearer TOKEN"
// 2. Verifica criptográficamente que el token es válido y no expiró
// 3. Busca al usuario en la BD para verificar que sigue activo
// 4. Adjunta el usuario completo a req.user para que el controlador lo use
// 5. Si algo falla → 401 Unauthorized
//
// ¿POR QUÉ verificar el usuario en la BD si el JWT ya lo valida?
// El JWT puede ser válido pero el usuario pudo haber sido desactivado
// mientras el token aún está vigente. Al consultar la BD en cada request
// protegido, garantizamos que usuarios desactivados no pueden operar.
//
// En sistemas de alto tráfico se puede usar Redis para cachear el usuario
// y evitar la query a BD en cada request — pero para este POS es suficiente.

import { extractTokenFromHeader, verifyAccessToken } from '../utils/jwt.js';
import { AuthenticationError } from '../utils/errors.js';
import { prisma } from '../config/database.js';

/**
 * Middleware que verifica el JWT y adjunta el usuario autenticado a req.user.
 * Uso: app.get('/ruta-protegida', authenticate, controller)
 */
export const authenticate = async (req, res, next) => {
  try {
    // 1. Extraer el token del header Authorization
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      throw new AuthenticationError(
        'Token de autenticación no proporcionado. Incluye el header: Authorization: Bearer TOKEN'
      );
    }

    // 2. Verificar criptográficamente el token
    // Si está expirado o fue alterado, verifyAccessToken lanza AuthenticationError
    const decoded = verifyAccessToken(token);

    // 3. Buscar el usuario en la BD para verificar su estado actual
    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.sub },  // decoded.sub es el userId que guardamos al firmar
      include: {
        rol: {
          include: {
            // Incluimos los permisos del rol para que authorize los pueda usar
            permisos: true,
          },
        },
      },
    });

    // 4. Validaciones de estado del usuario
    if (!usuario) {
      throw new AuthenticationError('Usuario no encontrado. El token es inválido.');
    }

    if (usuario.estado !== 'ACTIVO') {
      throw new AuthenticationError(
        'Tu cuenta está desactivada. Contacta al administrador del sistema.'
      );
    }

    if (usuario.bloqueadoPermanente) {
      throw new AuthenticationError(
        'Tu cuenta está bloqueada permanentemente. Contacta al administrador.'
      );
    }

    // 5. Adjuntar usuario completo a req para uso en controladores y middlewares
    // NUNCA adjuntamos el passwordHash — por seguridad
    const { passwordHash, ...usuarioSinPassword } = usuario;
    req.user = usuarioSinPassword;

    next(); // Todo bien, continuar al siguiente middleware o controlador
  } catch (error) {
    next(error); // Pasar al error handler global
  }
};

/**
 * Versión opcional del middleware authenticate.
 * Si hay token, lo verifica y adjunta el usuario.
 * Si NO hay token, continúa sin error (para rutas semi-públicas).
 * Uso: para endpoints que tienen comportamiento diferente si estás autenticado.
 */
export const authenticateOptional = async (req, res, next) => {
  const token = extractTokenFromHeader(req.headers.authorization);

  if (!token) {
    req.user = null;
    return next();
  }

  return authenticate(req, res, next);
};