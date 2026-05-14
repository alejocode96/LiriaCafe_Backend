// backend/src/modules/tables/routes.js
const { Router } = require('express');
const db = require('../../config/db');
const { ok, created, list, notFound } = require('../../utils/response');
const { authenticate } = require('../../middlewares/auth.middleware');
const { adminOnly, supervisorUp, staffOnly } = require('../../middlewares/roles.middleware');
const { logAudit } = require('../audit/service');

const router = Router();
router.use(authenticate);

// GET /tables - listar todas con pedido activo si aplica
router.get('/', staffOnly, (req, res) => {
  const tables = db.prepare(`
    SELECT t.*,
      (SELECT COUNT(*) FROM orders o WHERE o.table_id = t.id AND o.status = 'abierto') as has_open_order,
      (SELECT o.id FROM orders o WHERE o.table_id = t.id AND o.status = 'abierto' LIMIT 1) as open_order_id,
      (SELECT o.total FROM orders o WHERE o.table_id = t.id AND o.status = 'abierto' LIMIT 1) as open_order_total
    FROM tables t
    WHERE t.is_active = 1
    ORDER BY t.number ASC
  `).all();
  return list(res, tables);
});

// GET /tables/:id
router.get('/:id', staffOnly, (req, res) => {
  const t = db.prepare(`SELECT * FROM tables WHERE id = ? AND is_active = 1`).get(req.params.id);
  if (!t) return notFound(res, 'Mesa no encontrada');
  return ok(res, t);
});

// POST /tables
router.post('/', adminOnly, (req, res, next) => {
  try {
    const { name, number, capacity, zone, pos_x, pos_y, width, height } = req.body;
    if (!name || !number) return res.status(400).json({ success: false, message: 'name y number son requeridos' });
    const result = db.prepare(`
      INSERT INTO tables (name, number, capacity, zone, pos_x, pos_y, width, height)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, number, capacity || 4, zone || 'salon', pos_x || 0, pos_y || 0, width || 100, height || 80);
    const table = db.prepare(`SELECT * FROM tables WHERE id = ?`).get(result.lastInsertRowid);
    logAudit({ userId: req.user.id, action: 'CREATE', module: 'tables', targetId: table.id });
    return created(res, table, 'Mesa creada');
  } catch (e) { next(e); }
});

// PUT /tables/:id
router.put('/:id', supervisorUp, (req, res, next) => {
  try {
    const { name, number, capacity, zone, pos_x, pos_y, width, height, status, is_active } = req.body;
    const VALID_STATUS = ['libre','ocupada','reservada','pagando'];
    if (status && !VALID_STATUS.includes(status)) {
      return res.status(400).json({ success: false, message: `Status inválido: ${VALID_STATUS.join(', ')}` });
    }
    db.prepare(`
      UPDATE tables SET
        name       = COALESCE(?, name),
        number     = COALESCE(?, number),
        capacity   = COALESCE(?, capacity),
        zone       = COALESCE(?, zone),
        pos_x      = COALESCE(?, pos_x),
        pos_y      = COALESCE(?, pos_y),
        width      = COALESCE(?, width),
        height     = COALESCE(?, height),
        status     = COALESCE(?, status),
        is_active  = COALESCE(?, is_active),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(name, number, capacity, zone, pos_x, pos_y, width, height,
           status, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id);
    const table = db.prepare(`SELECT * FROM tables WHERE id = ?`).get(req.params.id);
    logAudit({ userId: req.user.id, action: 'UPDATE', module: 'tables', targetId: table.id });
    return ok(res, table, 'Mesa actualizada');
  } catch (e) { next(e); }
});

// PATCH /tables/:id/status - cambio rápido de estado
router.patch('/:id/status', staffOnly, (req, res, next) => {
  try {
    const { status } = req.body;
    const VALID = ['libre','ocupada','reservada','pagando'];
    if (!VALID.includes(status)) {
      return res.status(400).json({ success: false, message: 'Estado inválido' });
    }
    db.prepare(`UPDATE tables SET status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(status, req.params.id);
    return ok(res, { id: req.params.id, status }, 'Estado actualizado');
  } catch (e) { next(e); }
});

// DELETE /tables/:id (soft)
router.delete('/:id', adminOnly, (req, res, next) => {
  try {
    db.prepare(`UPDATE tables SET is_active = 0 WHERE id = ?`).run(req.params.id);
    return ok(res, null, 'Mesa desactivada');
  } catch (e) { next(e); }
});

module.exports = router;