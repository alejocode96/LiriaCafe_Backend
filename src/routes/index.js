/**
 * ============================================================
 * Archivo: backend/src/routes/index.js
 * Propósito:
 * Registro centralizado de todas las rutas de la API v1.
 *
 * Este archivo funciona como gateway principal de módulos.
 *
 * Ventajas:
 * - Organización limpia
 * - Escalabilidad sencilla
 * - Separación por dominios
 * - Versionado centralizado
 * - Fácil mantenimiento
 *
 * URL base desde app.js:
 * /api/v1
 *
 * Ejemplo final:
 * /api/v1/auth/login
 * /api/v1/products
 * /api/v1/reports/sales
 *
 * Porque meter 300 rutas en app.js es un crimen visual.
 * ============================================================
 */

const { Router } = require('express');

/**
 * ============================================================
 * Router principal Express
 * ============================================================
 */

const router = Router();

/**
 * ============================================================
 * MÓDULO AUTH
 * ============================================================
 *
 * Autenticación:
 * - login
 * - refresh token
 * - perfil actual
 * - logout (si aplica)
 */

router.use(
  '/auth',
  require('../modules/auth/routes')
);

/**
 * ============================================================
 * MÓDULO USERS
 * ============================================================
 *
 * Gestión de usuarios:
 * - crear
 * - listar
 * - editar
 * - activar/desactivar
 */

router.use(
  '/users',
  require('../modules/users/routes')
);

/**
 * ============================================================
 * MÓDULO ROLES
 * ============================================================
 *
 * Roles y permisos.
 */

router.use(
  '/roles',
  require('../modules/roles/routes')
);

/**
 * ============================================================
 * MÓDULO CATEGORIES
 * ============================================================
 *
 * Categorías de productos.
 */

router.use(
  '/categories',
  require('../modules/categories/routes')
);

/**
 * ============================================================
 * MÓDULO PRODUCTS
 * ============================================================
 *
 * Productos:
 * - inventario base
 * - precios
 * - stock
 */

router.use(
  '/products',
  require('../modules/products/routes')
);

/**
 * ============================================================
 * MÓDULO INVENTORY
 * ============================================================
 *
 * Movimientos de inventario:
 * - entradas
 * - salidas
 * - ajustes
 */

router.use(
  '/inventory',
  require('../modules/inventory/routes')
);

/**
 * ============================================================
 * MÓDULO TABLES
 * ============================================================
 *
 * Mesas físicas del negocio.
 */

router.use(
  '/tables',
  require('../modules/tables/routes')
);

/**
 * ============================================================
 * MÓDULO ORDERS
 * ============================================================
 *
 * Pedidos abiertos:
 * - mesa
 * - mostrador
 * - delivery
 */

router.use(
  '/orders',
  require('../modules/orders/routes')
);

/**
 * ============================================================
 * MÓDULO SALES
 * ============================================================
 *
 * Ventas cerradas y facturación.
 */

router.use(
  '/sales',
  require('../modules/sales/routes')
);

/**
 * ============================================================
 * MÓDULO CASH
 * ============================================================
 *
 * Caja:
 * - aperturas
 * - cierres
 * - movimientos
 */

router.use(
  '/cash',
  require('../modules/cash/routes')
);

/**
 * ============================================================
 * MÓDULO LOSSES
 * ============================================================
 *
 * Pérdidas:
 * - vencidos
 * - daños
 * - robo
 * - consumo interno
 */

router.use(
  '/losses',
  require('../modules/losses/routes')
);

/**
 * ============================================================
 * MÓDULO REPORTS
 * ============================================================
 *
 * Reportes gerenciales y operativos.
 */

router.use(
  '/reports',
  require('../modules/reports/routes')
);

/**
 * ============================================================
 * MÓDULO AUDIT
 * ============================================================
 *
 * Trazabilidad del sistema:
 * - acciones usuarios
 * - cambios críticos
 */

router.use(
  '/audit',
  require('../modules/audit/routes')
);

router.use('/clients',  require('../modules/clients/routes'));
router.use('/settings', require('../modules/settings/routes'));
/**
 * ============================================================
 * Cómo agregar un nuevo módulo
 * ============================================================
 *
 * 1. Crear carpeta:
 * modules/providers/routes.js
 *
 * 2. Registrar:
 *
 * router.use('/providers', require('../modules/providers/routes'));
 *
 * Milagrosamente simple.
 * ============================================================
 */

/**
 * ============================================================
 * Exportación principal
 * ============================================================
 */

module.exports = router;