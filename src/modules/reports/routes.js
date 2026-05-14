// backend/src/modules/reports/routes.js

/**
 * @module ReportsRoutes
 * @description Endpoints de reportes analíticos para dashboard del sistema POS.
 *
 * Este módulo centraliza consultas de agregación y análisis de datos:
 * - ventas diarias y mensuales
 * - productos más vendidos
 * - estado de inventario
 * - pérdidas
 * - resumen general del negocio (dashboard)
 *
 * No modifica datos, únicamente consulta información agregada.
 */

const { Router } = require('express');
const db = require('../../config/db');
const { ok } = require('../../utils/response');
const { authenticate } = require('../../middlewares/auth.middleware');
const { supervisorUp } = require('../../middlewares/roles.middleware');

const router = Router();

/**
 * Seguridad global:
 * Solo usuarios autenticados con rol supervisor o superior.
 */
router.use(authenticate, supervisorUp);

/**
 * GET /reports/sales/today
 * Resumen de ventas del día o fecha específica.
 *
 * Incluye:
 * - total de transacciones
 * - ingresos totales
 * - descuentos aplicados
 * - ticket promedio
 * - desglose por método de pago
 */
router.get('/sales/today', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];

  const data = db.prepare(`
    SELECT
      COUNT(*) as total_transactions,
      SUM(total) as total_revenue,
      SUM(discount) as total_discounts,
      AVG(total) as avg_ticket,
      SUM(CASE WHEN payment_method = 'efectivo' THEN total ELSE 0 END) as cash_total,
      SUM(CASE WHEN payment_method = 'transferencia' THEN total ELSE 0 END) as transfer_total
    FROM sales
    WHERE DATE(created_at) = ?
  `).get(date);

  return ok(res, { date, ...data });
});

/**
 * GET /reports/sales/monthly
 * Resumen mensual de ventas por año.
 *
 * Agrupa por mes:
 * - transacciones
 * - ingresos
 * - descuentos
 */
router.get('/sales/monthly', (req, res) => {
  const year = req.query.year || new Date().getFullYear();

  const months = db.prepare(`
    SELECT
      strftime('%m', created_at) as month,
      COUNT(*) as transactions,
      SUM(total) as revenue,
      SUM(discount) as discounts
    FROM sales
    WHERE strftime('%Y', created_at) = ?
    GROUP BY month
    ORDER BY month ASC
  `).all(String(year));

  return ok(res, { year, months });
});

/**
 * GET /reports/products/top
 * Top productos más vendidos.
 *
 * Parámetros:
 * - limit (default 10)
 * - days (ventana de análisis, default 30)
 */
router.get('/products/top', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const days = parseInt(req.query.days) || 30;

  const products = db.prepare(`
    SELECT
      si.product_id,
      si.product_name,
      SUM(si.quantity) as total_quantity,
      SUM(si.subtotal) as total_revenue,
      COUNT(DISTINCT si.sale_id) as times_sold
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.created_at >= datetime('now', '-${days} days')
    GROUP BY si.product_id, si.product_name
    ORDER BY total_quantity DESC
    LIMIT ?
  `).all(limit);

  return ok(res, { days, products });
});

/**
 * GET /reports/inventory/low-stock
 * Lista productos con stock bajo o crítico.
 */
router.get('/inventory/low-stock', (req, res) => {
  const products = db.prepare(`
    SELECT p.id, p.name, p.stock, p.min_stock, p.unit, c.name as category
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.track_stock = 1
      AND p.stock <= p.min_stock
      AND p.is_active = 1
      AND p.deleted_at IS NULL
    ORDER BY (p.stock - p.min_stock) ASC
  `).all();

  return ok(res, { total: products.length, products });
});

/**
 * GET /reports/losses/monthly
 * Análisis de pérdidas agrupadas por motivo.
 */
router.get('/losses/monthly', (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  const data = db.prepare(`
    SELECT
      l.reason,
      COUNT(*) as count,
      SUM(l.quantity) as total_quantity,
      SUM(l.cost_impact) as total_cost
    FROM losses l
    WHERE strftime('%Y-%m', l.created_at) = ?
    GROUP BY l.reason
    ORDER BY total_cost DESC
  `).all(month);

  const total = db.prepare(`
    SELECT SUM(cost_impact) as total
    FROM losses
    WHERE strftime('%Y-%m', created_at) = ?
  `).get(month);

  return ok(res, {
    month,
    total_cost: total.total || 0,
    by_reason: data,
  });
});

/**
 * GET /reports/dashboard
 * Endpoint principal del dashboard del sistema.
 *
 * Devuelve métricas en tiempo real:
 * - ventas del día
 * - pedidos abiertos
 * - mesas ocupadas
 * - stock crítico
 * - estado de caja
 */
router.get('/dashboard', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const todaySales = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
    FROM sales WHERE DATE(created_at) = ?
  `).get(today);

  const openOrders = db.prepare(`
    SELECT COUNT(*) as count FROM orders WHERE status = 'abierto'
  `).get();

  const openTables = db.prepare(`
    SELECT COUNT(*) as count FROM tables WHERE status = 'ocupada'
  `).get();

  const lowStock = db.prepare(`
    SELECT COUNT(*) as count
    FROM products
    WHERE track_stock = 1
      AND stock <= min_stock
      AND is_active = 1
      AND deleted_at IS NULL
  `).get();

  const cashSession = db.prepare(`
    SELECT cs.*,
      COALESCE(
        (SELECT SUM(cm.amount)
         FROM cash_movements cm
         WHERE cm.cash_session_id = cs.id
           AND cm.type = 'venta'
        ), 0
      ) as sales_total
    FROM cash_sessions cs
    WHERE cs.status = 'abierta'
    LIMIT 1
  `).get();

  return ok(res, {
    date: today,
    today_sales: todaySales,
    open_orders: openOrders.count,
    occupied_tables: openTables.count,
    low_stock_count: lowStock.count,
    cash_session: cashSession || null,
  });
});

module.exports = router;