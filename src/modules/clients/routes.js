// backend/src/modules/clients/routes.js
const { Router } = require('express');
const db = require('../../config/db');
const { ok, created, list, notFound } = require('../../utils/response');
const { authenticate } = require('../../middlewares/auth.middleware');
const { staffOnly, supervisorUp } = require('../../middlewares/roles.middleware');
const { buildPagination } = require('../../utils/helpers');

const router = Router();
router.use(authenticate);

// GET /clients
router.get('/', staffOnly, (req, res) => {
  const { limit, offset, page, pageSize } = buildPagination(req.query);
  const search = req.query.search;

  let where = 'WHERE is_active = 1';
  const params = [];
  if (search) {
    where += ` AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM clients ${where}`).get(...params).c;
  const rows  = db.prepare(`
    SELECT * FROM clients ${where}
    ORDER BY name ASC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return list(res, rows, { total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

// GET /clients/:id
router.get('/:id', staffOnly, (req, res) => {
  const client = db.prepare(`SELECT * FROM clients WHERE id = ? AND is_active = 1`).get(req.params.id);
  if (!client) return notFound(res, 'Cliente no encontrado');
  return ok(res, client);
});

// POST /clients
router.post('/', staffOnly, (req, res, next) => {
  try {
    const { name, phone, email, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name es requerido' });

    const result = db.prepare(`
      INSERT INTO clients (name, phone, email, notes)
      VALUES (?, ?, ?, ?)
    `).run(name, phone || null, email || null, notes || null);

    const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(result.lastInsertRowid);
    return created(res, client, 'Cliente creado');
  } catch (e) { next(e); }
});

// PUT /clients/:id
router.put('/:id', staffOnly, (req, res, next) => {
  try {
    const { name, phone, email, notes } = req.body;
    db.prepare(`
      UPDATE clients SET
        name  = COALESCE(?, name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        notes = COALESCE(?, notes),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(name, phone, email, notes, req.params.id);

    const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(req.params.id);
    return ok(res, client, 'Cliente actualizado');
  } catch (e) { next(e); }
});

// DELETE /clients/:id (soft)
router.delete('/:id', supervisorUp, (req, res, next) => {
  try {
    db.prepare(`UPDATE clients SET is_active = 0 WHERE id = ?`).run(req.params.id);
    return ok(res, null, 'Cliente eliminado');
  } catch (e) { next(e); }
});

module.exports = router;