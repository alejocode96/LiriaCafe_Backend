// src/middlewares/authorize.js
//
// ¿QUÉ HACE ESTE MIDDLEWARE?
// Implementa el sistema RBAC (Role-Based Access Control) del documento (sección 3).
//
// El documento dice: "Las acciones controladas por rol son:
// Crear, Ver, Editar, Desactivar y Acceder a Reportes."
//
// authorize(MODULO.PRODUCTOS, ACCION.CREAR) verifica que el rol del usuario
// tenga el permiso de CREAR en el módulo PRODUCTOS.
//
// SIEMPRE va DESPUÉS de authenticate:
//   router.post('/', authenticate, authorize('PRODUCTOS', 'CREAR'), controller)
//
// ¿POR QUÉ separar authenticate de authorize?
// Porque son responsabilidades distintas:
// - authenticate: ¿Quién eres? (identidad)
// - authorize: ¿Qué puedes hacer? (permisos)
// Separarlos permite componerlos de forma flexible.

import { AuthorizationError } from '../utils/errors.js';

/**
 * Genera un middleware que verifica si el usuario tiene un permiso específico.
 *
 * @param {string} modulo - Módulo del sistema (ej: 'PRODUCTOS', 'VENTAS')
 * @param {string} accion - Acción requerida (ej: 'CREAR', 'VER', 'EDITAR')
 * @returns {Function} Middleware de Express
 *
 * Uso:
 *   router.post('/', authenticate, authorize('PRODUCTOS', 'CREAR'), crearProducto)
 *   router.get('/', authenticate, authorize('REPORTES', 'VER'), verReportes)
 */
export const authorize = (modulo, accion) => {
  return (req, res, next) => {
    // req.user fue adjuntado por el middleware authenticate
    // Si authorize se usa sin authenticate antes, esto fallará — es intencional
    if (!req.user) {
      return next(
        new AuthorizationError('Se requiere autenticación antes de verificar permisos.')
      );
    }

    // El rol Administrador tiene todos los permisos siempre
    // Es el único rol predefinido e inmutable (sección 3.4 del documento)
    if (req.user.rol?.esAdmin) {
      return next();
    }

    // Buscar el permiso específico en los permisos del rol del usuario
    const permiso = req.user.rol?.permisos?.find(
      (p) => p.modulo === modulo && p.accion === accion
    );

    if (!permiso || !permiso.permitido) {
      return next(
        new AuthorizationError(
          `No tienes permiso para ${accion.toLowerCase()} en el módulo de ${modulo.toLowerCase()}.`
        )
      );
    }

    next(); // Tiene el permiso — continuar
  };
};

/**
 * Verifica que el usuario es Administrador.
 * Atajo para rutas exclusivas del administrador.
 *
 * Uso: router.get('/admin/config', authenticate, requireAdmin, controller)
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AuthorizationError('Se requiere autenticación.'));
  }

  if (!req.user.rol?.esAdmin) {
    return next(
      new AuthorizationError('Esta acción requiere permisos de Administrador.')
    );
  }

  next();
};