/**
 * ============================================================
 * Archivo: backend/src/middlewares/roles.middleware.js
 * Propósito:
 * Control de autorización basado en roles (RBAC).
 *
 * Permite restringir rutas según el cargo del usuario:
 * - Administrador
 * - Supervisor
 * - Cajero
 * - Mesero
 *
 * Requiere:
 * authenticate middleware ejecutado antes.
 *
 * Uso:
 * router.get(
 *   '/usuarios',
 *   authenticate,
 *   requireRole(['Administrador']),
 *   controller
 * );
 *
 * Porque dejar cualquier endpoint abierto a cualquiera
 * siempre produce historias graciosas para otros.
 * ============================================================
 */

const {
  forbidden,
} = require('../utils/response');

/**
 * ============================================================
 * requireRole(allowedRoles)
 * ============================================================
 *
 * Factory middleware.
 *
 * Recibe:
 * allowedRoles = array de roles permitidos
 *
 * Retorna:
 * middleware Express
 *
 * Ejemplo:
 * requireRole(['Administrador', 'Supervisor'])
 */

const requireRole = (
  allowedRoles
) => {
  return (
    req,
    res,
    next
  ) => {
    /**
     * ========================================================
     * Usuario no autenticado
     * ========================================================
     *
     * Normalmente esto no debería pasar si se usa
     * authenticate antes.
     */

    if (!req.user) {
      return forbidden(
        res,
        'Usuario no autenticado'
      );
    }

    /**
     * ========================================================
     * Bypass Administrador
     * ========================================================
     *
     * El Administrador siempre tiene acceso total.
     */

    if (
      req.user.role_name ===
      'Administrador'
    ) {
      return next();
    }

    /**
     * ========================================================
     * Validar rol permitido
     * ========================================================
     */

    if (
      !allowedRoles.includes(
        req.user.role_name
      )
    ) {
      return forbidden(
        res,
        `Acceso denegado. Roles permitidos: ${allowedRoles.join(', ')}`
      );
    }

    /**
     * Acceso concedido
     */

    next();
  };
};

/**
 * ============================================================
 * Atajos reutilizables
 * ============================================================
 */

/**
 * Solo Administrador
 */

const adminOnly =
  requireRole([
    'Administrador',
  ]);

/**
 * Administrador o Supervisor
 */

const supervisorUp =
  requireRole([
    'Administrador',
    'Supervisor',
  ]);

/**
 * Todo personal interno
 *
 * Incluye:
 * - Administrador
 * - Supervisor
 * - Cajero
 * - Mesero
 */

const staffOnly =
  requireRole([
    'Administrador',
    'Supervisor',
    'Cajero',
    'Mesero',
  ]);

/**
 * ============================================================
 * Exportación pública
 * ============================================================
 */

module.exports = {
  requireRole,
  adminOnly,
  supervisorUp,
  staffOnly,
};