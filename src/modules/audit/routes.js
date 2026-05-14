// backend/src/modules/audit/routes.js
// ─────────────────────────────────────────────────────────────
// Módulo de consulta de auditoría del sistema
// Permite a administradores revisar trazabilidad de acciones
// ─────────────────────────────────────────────────────────────

const { Router } = require('express');
const db = require('../../config/db');
const { list } = require('../../utils/response');
const { authenticate } = require('../../middlewares/auth.middleware');
const { adminOnly } = require('../../middlewares/roles.middleware');
const { buildPagination } = require('../../utils/helpers');

const router = Router();

/**
 * Todas las rutas de auditoría requieren:
 * - Usuario autenticado
 * - Rol administrador (adminOnly)
 */
router.use(authenticate, adminOnly);

/**
 * GET /audit
 * Obtiene el historial de auditoría con filtros opcionales
 *
 * Filtros disponibles:
 * - module: módulo afectado (users, products, orders, etc.)
 * - action: tipo de acción (CREATE, UPDATE, DELETE, etc.)
 * - user_id: usuario que ejecutó la acción
 * - from: fecha inicial (created_at >= from)
 *
 * Soporta paginación estándar del sistema
 */
router.get('/', (req, res) => {
  const { limit, offset, page, pageSize } = buildPagination(req.query);

  let where = 'WHERE 1=1';
  const params = [];

  if (req.query.module) {
    where += ` AND al.module = ?`;
    params.push(req.query.module);
  }

  if (req.query.action) {
    where += ` AND al.action = ?`;
    params.push(req.query.action);
  }

  if (req.query.user_id) {
    where += ` AND al.user_id = ?`;
    params.push(req.query.user_id);
  }

  if (req.query.from) {
    where += ` AND al.created_at >= ?`;
    params.push(req.query.from);
  }

  /**
   * Total de registros para paginación
   */
  const total = db.prepare(
    `SELECT COUNT(*) as c FROM audit_logs al ${where}`
  ).get(...params).c;

  /**
   * Datos paginados con información del usuario asociado
   */
  const rows = db.prepare(`
    SELECT al.*, u.name as user_name, u.username
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    ${where}
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return list(res, rows, {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

module.exports = router;