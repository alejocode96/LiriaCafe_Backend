// backend/src/modules/cash/routes.js

/**
 * @module CashRoutes
 * @description Módulo de gestión de caja (cash register).
 *
 * Este módulo controla el ciclo completo de caja del sistema POS:
 * - Apertura de caja
 * - Cierre de caja
 * - Movimientos manuales (ingresos, retiros, gastos)
 * - Consulta de estado actual
 * - Historial de sesiones
 *
 * Es un módulo crítico del sistema financiero del negocio.
 * Controla el flujo de efectivo generado por ventas y movimientos internos.
 */

const { Router } = require('express');
const db = require('../../config/db');
const { ok, created, list } = require('../../utils/response');
const { authenticate } = require('../../middlewares/auth.middleware');
const { staffOnly, supervisorUp } = require('../../middlewares/roles.middleware');

const router = Router();

/**
 * Middleware global:
 * Todas las operaciones de caja requieren autenticación.
 */
router.use(authenticate);

/**
 * GET /cash/current
 * Obtiene la sesión de caja actualmente abierta (si existe).
 *
 * Incluye:
 * - datos de la sesión
 * - usuario responsable
 * - suma de movimientos
 * - últimos 20 movimientos
 */
router.get('/current', staffOnly, (req, res) => {
  const session = db.prepare(`
    SELECT cs.*, u.name as user_name,
      (SELECT SUM(cm.amount)
       FROM cash_movements cm
       WHERE cm.cash_session_id = cs.id) as total_movements
    FROM cash_sessions cs
    JOIN users u ON cs.user_id = u.id
    WHERE cs.status = 'abierta'
    LIMIT 1
  `).get();

  if (!session) {
    return ok(res, null, 'No hay caja abierta');
  }

  session.movements = db.prepare(`
    SELECT cm.*, u.name as user_name
    FROM cash_movements cm
    LEFT JOIN users u ON cm.user_id = u.id
    WHERE cm.cash_session_id = ?
    ORDER BY cm.created_at DESC
    LIMIT 20
  `).all(session.id);

  return ok(res, session);
});

/**
 * POST /cash/open
 * Abre una nueva sesión de caja.
 *
 * Reglas:
 * - Solo puede existir una caja abierta
 * - Registra movimiento automático de apertura
 *
 * Body:
 * - opening_amount (number)
 * - notes (string, optional)
 */
router.post('/open', supervisorUp, (req, res, next) => {
  try {
    const existing = db.prepare(`
      SELECT id FROM cash_sessions WHERE status = 'abierta'
    `).get();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Ya hay una caja abierta (sesión #${existing.id})`,
      });
    }

    const { opening_amount, notes } = req.body;

    const result = db.prepare(`
      INSERT INTO cash_sessions (user_id, opening_amount, notes, status)
      VALUES (?, ?, ?, 'abierta')
    `).run(
      req.user.id,
      parseFloat(opening_amount) || 0,
      notes || null
    );

    // Movimiento automático de apertura
    db.prepare(`
      INSERT INTO cash_movements (cash_session_id, type, amount, description, user_id)
      VALUES (?, 'apertura', ?, 'Apertura de caja', ?)
    `).run(
      result.lastInsertRowid,
      parseFloat(opening_amount) || 0,
      req.user.id
    );

    const session = db.prepare(`
      SELECT * FROM cash_sessions WHERE id = ?
    `).get(result.lastInsertRowid);

    return created(res, session, 'Caja abierta');
  } catch (e) {
    next(e);
  }
});

/**
 * POST /cash/close
 * Cierra la sesión de caja activa.
 *
 * Calcula:
 * - total esperado
 * - total real ingresado
 * - diferencia de caja (descuadre)
 */
router.post('/close', supervisorUp, (req, res, next) => {
  try {
    const session = db.prepare(`
      SELECT * FROM cash_sessions WHERE status = 'abierta' LIMIT 1
    `).get();

    if (!session) {
      return res.status(400).json({
        success: false,
        message: 'No hay caja abierta',
      });
    }

    const { closing_amount, notes } = req.body;

    const movements = db.prepare(`
      SELECT SUM(amount) as total
      FROM cash_movements
      WHERE cash_session_id = ?
    `).get(session.id);

    const expectedAmount =
      (session.opening_amount || 0) + (movements.total || 0);

    const difference =
      (parseFloat(closing_amount) || 0) - expectedAmount;

    db.prepare(`
      UPDATE cash_sessions SET
        status = 'cerrada',
        closing_amount = ?,
        expected_amount = ?,
        difference = ?,
        notes = COALESCE(?, notes),
        closed_at = datetime('now')
      WHERE id = ?
    `).run(
      parseFloat(closing_amount) || 0,
      expectedAmount,
      difference,
      notes,
      session.id
    );

    // Movimiento automático de cierre
    db.prepare(`
      INSERT INTO cash_movements (cash_session_id, type, amount, description, user_id)
      VALUES (?, 'cierre', ?, 'Cierre de caja', ?)
    `).run(
      session.id,
      parseFloat(closing_amount) || 0,
      req.user.id
    );

    const closed = db.prepare(`
      SELECT * FROM cash_sessions WHERE id = ?
    `).get(session.id);

    return ok(res, closed, 'Caja cerrada');
  } catch (e) {
    next(e);
  }
});

/**
 * POST /cash/movements
 * Registra movimientos manuales en caja.
 *
 * Tipos:
 * - ingreso (positivo)
 * - retiro (negativo)
 * - gasto (negativo)
 */
router.post('/movements', supervisorUp, (req, res, next) => {
  try {
    const session = db.prepare(`
      SELECT * FROM cash_sessions WHERE status = 'abierta' LIMIT 1
    `).get();

    if (!session) {
      return res.status(400).json({
        success: false,
        message: 'No hay caja abierta',
      });
    }

    const { type, amount, description } = req.body;

    const VALID = ['ingreso', 'retiro', 'gasto'];
    if (!VALID.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Tipo inválido. Válidos: ${VALID.join(', ')}`,
      });
    }

    const finalAmount = ['retiro', 'gasto'].includes(type)
      ? -Math.abs(parseFloat(amount))
      : Math.abs(parseFloat(amount));

    const result = db.prepare(`
      INSERT INTO cash_movements (cash_session_id, type, amount, description, user_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      session.id,
      type,
      finalAmount,
      description || null,
      req.user.id
    );

    const movement = db.prepare(`
      SELECT * FROM cash_movements WHERE id = ?
    `).get(result.lastInsertRowid);

    return created(res, movement, 'Movimiento registrado');
  } catch (e) {
    next(e);
  }
});

/**
 * GET /cash/sessions
 * Historial de sesiones de caja.
 */
router.get('/sessions', supervisorUp, (req, res) => {
  const sessions = db.prepare(`
    SELECT cs.*, u.name as user_name,
      (SELECT COUNT(*)
       FROM cash_movements cm
       WHERE cm.cash_session_id = cs.id
       AND cm.type = 'venta') as total_sales
    FROM cash_sessions cs
    JOIN users u ON cs.user_id = u.id
    ORDER BY cs.opened_at DESC
    LIMIT 30
  `).all();

  return list(res, sessions);
});

module.exports = router;