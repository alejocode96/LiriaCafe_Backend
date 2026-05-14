/**
 * ====================================
 * Archivo: backend/src/database/schema.js
 * propósito: definir y crear toda la estructura de base de datos del sistema
 * 
 * características:
 * - Creación automática de tablas
 * - Idempotente (puede ejecutarse múltiples veces)
 * - Usa transacción atómica
 * - Índices para rendimiento
 * - Integridad relacional con Foreign Keys
 * 
 * Uso típico:
 * const {createSchema}=require(./schema);
 * createSchema();
 * 
 * se recomienda ejecutar:
 * - primer arranque
 * - instalaciones nuevas
 * - despliegues controlados
 * =================================
 */

const db = require('../config/db');
const logger = require('../config/logger');

/**
 * =====================================
 * createSchema()
 * =====================================
 * 
 * verifica y crea todas las tablas necesarias
 * 
 * Estrategia:
 * - CREATE TABLE IF NOT EXISTS
 * - CREATE INDEX IF NOT EXISTS
 * 
 * Esto permite ejecutar el archivo varias veces sin destruir datos existentes
 */

function createSchema(){
    logger.info('verificando/creando schema de base de datos...');
    /**
     * ===============================
     * Transacción principal
     * ===============================
     * 
     * si ocurre error en cualquier bloque:
     * - rollback automático
     * - no queda estructura parcial
     */
    const migrate = db.transaction(()=>{
        /**
         * ==========================
         * ROLES
         * ==========================
         * 
         * Define perfiles de acceso:
         * - administrador
         * - cajero
         * 
         * permissions:
         * JSON serializado con privilegios del módulo.
         */
        db.exec(`
            CREATE TABLE IF NOT EXISTS roles(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                permissions TEXT DEFAULT '{}',
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );
        `);

        /**
         * ================================
         * USERS
         * ================================
         * 
         * Usuarios autenticados del sistema.
         * 
         * Incluye:
         * - credenciales
         * - rol asociado
         * - bloqueo por intentos fallidos
         * - soft delete
         */
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role_id INTEGER NOT NULL REFERENCES roles(id),
                is_active INTEGER DEFAULT 1,
                login_attempts INTEGER DEFAULT 0,
                locked_until TEXT,
                last_login TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                deleted_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_users_username
            ON users(username);

            CREATE INDEX IF NOT EXISTS idx_users_role_id
            ON users(role_id);
        `);

        /**
         * ====================================
         * CATEGORIES
         * ====================================
         * 
         * Categorías de productos:
         * café, licor, snacks, cocina, etc.
         */
        db.exec(`
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                color TEXT DEFAULT '#6B7280',
                icon TEXT,
                sort_order INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );
        `);

        /**
         * ====================================
         * PRODUCTS
         * ====================================
         * 
         * Catálogo de venta e inventario.
         * Incluye:
         * - costo
         * - precio venta
         * - stock
         * - código barras
         * - imagen
         */
        db.exec(`
            CREATE TABLE IF NOT EXISTS products(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                category_id INTEGER REFERENCES categories(id),
                cost_price REAL DEFAULT 0,
                sale_price REAL NOT NULL,
                stock REAL DEFAULT 0,
                min_stock REAL DEFAULT 0,
                unit TEXT DEFAULT 'unidad',
                barcode TEXT UNIQUE,
                image_url TEXT,
                is_active INTEGER DEFAULT 1,
                track_stock INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                deleted_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_products_category
            ON products(category_id);

            CREATE INDEX IF NOT EXISTS idx_products_barcode
            ON products(barcode);
        `);

        /**
         * ========================================================
         * INVENTORY_MOVEMENTS
         * ========================================================
         *
         * Kardex de movimientos:
         * entrada, salida, venta, pérdida, ajuste.
         *
         * Fundamental para trazabilidad.
         */
        db.exec(`
            CREATE TABLE IF NOT EXISTS inventory_movements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL REFERENCES products(id),
                type TEXT NOT NULL,
                quantity REAL NOT NULL,
                stock_before REAL NOT NULL,
                stock_after REAL NOT NULL,
                cost_price REAL DEFAULT 0,
                reason TEXT,
                reference_id INTEGER,
                user_id INTEGER REFERENCES users(id),
                created_at TEXT DEFAULT (datetime('now'))
            );
    `   );
        
         /**
         * ========================================================
         * TABLES
         * ========================================================
         *
         * Mesas físicas del negocio.
         *
         * Incluye posición visual para plano táctil.
         */

        db.exec(`
            CREATE TABLE IF NOT EXISTS tables (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                number INTEGER NOT NULL UNIQUE,
                capacity INTEGER DEFAULT 4,
                pos_x REAL DEFAULT 0,
                pos_y REAL DEFAULT 0,
                width REAL DEFAULT 100,
                height REAL DEFAULT 80,
                status TEXT DEFAULT 'libre',
                zone TEXT DEFAULT 'salon',
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );
        `);

        /**
         * ========================================================
         * CLIENTS
         * ========================================================
         *
         * Clientes frecuentes o registrados.
         */

        db.exec(`
            CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                notes TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );
        `);

        /**
         * ========================================================
         * ORDERS / ORDER_ITEMS
         * ========================================================
         *
         * Pedidos abiertos del flujo operativo:
         * mesa, delivery, mostrador, para llevar.
         */

        db.exec(`
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_id INTEGER REFERENCES tables(id),
                client_id INTEGER REFERENCES clients(id),
                user_id INTEGER NOT NULL REFERENCES users(id),
                status TEXT DEFAULT 'abierto',
                order_type TEXT DEFAULT 'mesa',
                notes TEXT,
                subtotal REAL DEFAULT 0,
                discount REAL DEFAULT 0,
                tax REAL DEFAULT 0,
                total REAL DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                closed_at TEXT
            );
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL REFERENCES orders(id)
                ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES products(id),
                quantity REAL NOT NULL,
                unit_price REAL NOT NULL,
                subtotal REAL NOT NULL,
                notes TEXT,
                status TEXT DEFAULT 'pendiente',
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );
        `);

        /**
         * ========================================================
         * CASH_SESSIONS / CASH_MOVEMENTS
         * ========================================================
         *
         * Control de apertura y cierre de caja.
         */

        db.exec(`
            CREATE TABLE IF NOT EXISTS cash_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                opening_amount REAL NOT NULL DEFAULT 0,
                closing_amount REAL,
                expected_amount REAL,
                difference REAL,
                status TEXT DEFAULT 'abierta',
                notes TEXT,
                opened_at TEXT DEFAULT (datetime('now')),
                closed_at TEXT
            );
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS cash_movements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cash_session_id INTEGER NOT NULL REFERENCES cash_sessions(id),
                type TEXT NOT NULL,
                amount REAL NOT NULL,
                description TEXT,
                reference_id INTEGER,
                user_id INTEGER REFERENCES users(id),
                created_at TEXT DEFAULT (datetime('now'))
            );
        `);

        /**
         * ========================================================
         * SALES / SALE_ITEMS
         * ========================================================
         *
         * Ventas cerradas oficialmente.
         *
         * Snapshot histórico de productos vendidos.
         */

        db.exec(`
            CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER REFERENCES orders(id),
                cash_session_id INTEGER REFERENCES cash_sessions(id),
                user_id INTEGER NOT NULL REFERENCES users(id),
                client_id INTEGER REFERENCES clients(id),
                subtotal REAL NOT NULL,
                discount REAL DEFAULT 0,
                tax REAL DEFAULT 0,
                total REAL NOT NULL,
                payment_method TEXT NOT NULL,
                cash_received REAL DEFAULT 0,
                change_given REAL DEFAULT 0,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS sale_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id INTEGER NOT NULL REFERENCES sales(id)
                ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES products(id),
                product_name TEXT NOT NULL,
                quantity REAL NOT NULL,
                unit_price REAL NOT NULL,
                cost_price REAL DEFAULT 0,
                subtotal REAL NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );
        `);

        /**
         * ========================================================
         * LOSSES
         * ========================================================
         *
         * Pérdidas operativas:
         * robo, daño, vencido, consumo interno, etc.
         */

        db.exec(`
            CREATE TABLE IF NOT EXISTS losses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL REFERENCES products(id),
                quantity REAL NOT NULL,
                cost_impact REAL NOT NULL DEFAULT 0,
                reason TEXT NOT NULL,
                description TEXT,
                user_id INTEGER REFERENCES users(id),
                created_at TEXT DEFAULT (datetime('now'))
            );
        `);

        /**
         * ========================================================
         * SETTINGS
         * ========================================================
         *
         * Parámetros configurables del sistema.
         */

        db.exec(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                type TEXT DEFAULT 'string',
                description TEXT,
                updated_at TEXT DEFAULT (datetime('now'))
            );
        `);

        /**
         * ========================================================
         * AUDIT_LOGS
         * ========================================================
         *
         * Bitácora de acciones críticas:
         * login, cambios, eliminaciones, ventas, etc.
         */

        db.exec(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id),
                action TEXT NOT NULL,
                module TEXT NOT NULL,
                target_id INTEGER,
                payload TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
        `);

    });

    /** * Ejecutar migración*/
    migrate();
    logger.info('Schema creado/verificado correctamente');

}

/**
 * ============================================================
 * Exportación pública
 * ============================================================
 */

module.exports = {
  createSchema,
};