/**
 * ============================================================
 * Archivo: backend/src/database/seed.js
 * Propósito:
 * Insertar datos iniciales requeridos para operar el sistema
 * LIRIACAFE POS después de crear el schema.
 *
 * Filosofía:
 * - Idempotente
 * - Seguro de ejecutar múltiples veces
 * - No duplica registros existentes
 *
 * Casos de uso:
 * - Primera instalación
 * - Entorno desarrollo
 * - Reinicio controlado de base de datos
 * - Inicialización automática del sistema
 *
 * Uso:
 * const { runSeed } = require('./seed');
 * await runSeed();
 * ============================================================
 */

const bcrypt = require('bcrypt');
const db = require('../config/db');
const logger = require('../config/logger');

/**
 * ============================================================
 * runSeed()
 * ============================================================
 *
 * Inserta:
 * - Roles base
 * - Usuario administrador
 * - Categorías iniciales
 * - Configuración general
 * - Mesas de ejemplo
 */

async function runSeed() {
  logger.info('Ejecutando seed inicial...');

  /**
   * ==========================================================
   * ROLES DEL SISTEMA
   * ==========================================================
   *
   * Define perfiles operativos base.
   *
   * permissions:
   * Se almacena como JSON serializado.
   */

  const roles = [
    {
      name: 'Administrador',
      description: 'Acceso total al sistema',
      permissions: JSON.stringify({
        all: true,
      }),
    },

    // {
    //   name: 'Supervisor',
    //   description: 'Gestión operativa, reportes y usuarios',
    //   permissions: JSON.stringify({
    //     sales: true,
    //     reports: true,
    //     products: true,
    //     inventory: true,
    //     users: ['read', 'update'],
    //   }),
    // },

    {
      name: 'Cajero',
      description: 'Ventas, caja y pedidos mostrador',
      permissions: JSON.stringify({
        sales: true,
        cash: true,
        orders: true,
        tables: true,
        products: ['read'],
      }),
    },

  ];

  /**
   * INSERT OR IGNORE:
   * Si el rol ya existe, no falla ni duplica.
   */

  const insertRole = db.prepare(`
    INSERT OR IGNORE INTO roles
    (name, description, permissions)
    VALUES
    (@name, @description, @permissions)
  `);

  for (const role of roles) {
    insertRole.run(role);
  }

  logger.info(
    `Roles: ${roles.length} insertados/verificados`
  );

  /**
   * ==========================================================
   * USUARIO ADMINISTRADOR INICIAL
   * ==========================================================
   *
   * Se crea solo si no existe.
   */

  const adminRole = db
    .prepare(`
      SELECT id
      FROM roles
      WHERE name = 'Administrador'
    `)
    .get();

  const adminExists = db
    .prepare(`
      SELECT id
      FROM users
      WHERE username = 'admin'
    `)
    .get();

  if (!adminExists) {
    /**
     * Hash seguro de contraseña
     * Cost factor 12
     */

    const passwordHash = await bcrypt.hash(
      'Admin123*',
      12
    );

    db.prepare(`
      INSERT INTO users
      (name, username, password_hash, role_id)
      VALUES
      ('Administrador', 'admin', ?, ?)
    `).run(passwordHash, adminRole.id);

    logger.info(
      'Usuario admin creado: admin / Admin123*'
    );
  } else {
    logger.info('Usuario admin ya existe');
  }

  /**
   * ==========================================================
   * CATEGORÍAS INICIALES
   * ==========================================================
   *
   * Usadas para organización visual y operativa.
   */

  const categories = [
  {
    name: 'Bebidas Calientes',
    description: 'Café, chocolate, aromáticas y bebidas calientes',
    color: '#92400E',
    icon: '☕',
    sort_order: 1,
  },
  {
    name: 'Bebidas Frías',
    description: 'Jugos, limonadas, gaseosas y frappés',
    color: '#0EA5E9',
    icon: '🧃',
    sort_order: 2,
  },
  {
    name: 'Empanadas',
    description: 'Empanadas y fritos listos para servir',
    color: '#D97706',
    icon: '🥟',
    sort_order: 3,
  },
  {
    name: 'Sandwich',
    description: 'Sándwiches y productos preparados',
    color: '#F97316',
    icon: '🥪',
    sort_order: 4,
  },
  {
    name: 'Snacks',
    description: 'Pasabocas, mecato y acompañamientos',
    color: '#F59E0B',
    icon: '🍟',
    sort_order: 5,
  },
  {
    name: 'Postres',
    description: 'Tortas, dulces, helados y repostería',
    color: '#EC4899',
    icon: '🍰',
    sort_order: 6,
  },
  {
    name: 'Combos',
    description: 'Promociones y combos especiales',
    color: '#10B981',
    icon: '🎁',
    sort_order: 7,
  },
  {
    name: 'Otros',
    description: 'Productos varios',
    color: '#6B7280',
    icon: '📦',
    sort_order: 8,
  },
];

  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO categories
    (name, description, color, icon, sort_order)
    VALUES
    (@name, @description, @color, @icon, @sort_order)
  `);

  for (const category of categories) {
    insertCategory.run(category);
  }

  logger.info(
    `Categorías: ${categories.length} insertadas/verificadas`
  );

  /**
   * ==========================================================
   * SETTINGS INICIALES
   * ==========================================================
   *
   * Parámetros editables desde panel futuro.
   */

  const settings = [
    {
      key: 'business_name',
      value: 'LIRIACAFE',
      type: 'string',
      description: 'Nombre del negocio',
    },
    {
      key: 'currency',
      value: 'COP',
      type: 'string',
      description: 'Moneda',
    },
    {
      key: 'currency_symbol',
      value: '$',
      type: 'string',
      description: 'Símbolo monetario',
    },
    {
      key: 'tax_rate',
      value: '0',
      type: 'number',
      description: 'IVA',
    },
    {
      key: 'receipt_footer',
      value: '¡Gracias por visitarnos!',
      type: 'string',
      description: 'Pie de factura',
    },
  ];

  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings
    (key, value, type, description)
    VALUES
    (@key, @value, @type, @description)
  `);

  for (const setting of settings) {
    insertSetting.run(setting);
  }

  logger.info(
    `Settings: ${settings.length} configuraciones cargadas`
  );

  /**
   * ==========================================================
   * MESAS INICIALES
   * ==========================================================
   *
   * Solo se insertan si no existen registros previos.
   */

  const tablesExist = db
    .prepare(`
      SELECT COUNT(*) as count
      FROM tables
    `)
    .get();

  if (tablesExist.count === 0) {
    const tables = [
      {
        name: 'Mesa 1',
        number: 1,
        capacity: 4,
        pos_x: 50,
        pos_y: 50,
        zone: 'salon',
      },
      {
        name: 'Mesa 2',
        number: 2,
        capacity: 4,
        pos_x: 200,
        pos_y: 50,
        zone: 'salon',
      },
      {
        name: 'Mesa 3',
        number: 3,
        capacity: 2,
        pos_x: 350,
        pos_y: 50,
        zone: 'salon',
      },
      {
        name: 'Mesa Auxiliar 1',
        number: 4,
        capacity: 2,
        pos_x: 50,
        pos_y: 250,
        zone: 'salon',
      },
    ];

    const insertTable = db.prepare(`
      INSERT INTO tables
      (name, number, capacity, pos_x, pos_y, zone)
      VALUES
      (@name, @number, @capacity, @pos_x, @pos_y, @zone)
    `);

    for (const table of tables) {
      insertTable.run(table);
    }

    logger.info(
      `Mesas: ${tables.length} creadas`
    );
  }

  /**
   * ==========================================================
   * FIN
   * ==========================================================
   */

  logger.info('Seed completado exitosamente ✓');
}

/**
 * ============================================================
 * Exportación pública
 * ============================================================
 */

module.exports = {
  runSeed,
};