// backend/src/modules/settings/routes.js
// ─────────────────────────────────────────────────────────────
// Módulo de configuración del sistema (Settings)
// ─────────────────────────────────────────────────────────────
//
// Este módulo permite gestionar configuraciones dinámicas del sistema
// almacenadas en base de datos.
//
// Uso típico:
// - Parámetros del sistema POS
// - Configuración de negocio (impuestos, moneda, etc.)
// - Flags de comportamiento del sistema
//
// Seguridad:
// - Lectura: staff y superiores
// - Escritura: solo administradores
// ─────────────────────────────────────────────────────────────

const { Router } = require('express');
const db = require('../../config/db');
const { ok, list } = require('../../utils/response');
const { authenticate } = require('../../middlewares/auth.middleware');
const { adminOnly, staffOnly } = require('../../middlewares/roles.middleware');

const router = Router();

/**
 * Todas las rutas requieren autenticación
 */
router.use(authenticate);

/**
 * GET /settings
 * Retorna todas las configuraciones del sistema
 */
router.get('/', staffOnly, (req, res) => {
  const settings = db.prepare(`
    SELECT * FROM settings ORDER BY key ASC
  `).all();

  return list(res, settings);
});

/**
 * GET /settings/:key
 * Obtiene una configuración específica por su clave
 */
router.get('/:key', staffOnly, (req, res) => {
  const setting = db.prepare(`
    SELECT * FROM settings WHERE key = ?
  `).get(req.params.key);

  if (!setting) {
    return res.status(404).json({
      success: false,
      message: 'Configuración no encontrada',
    });
  }

  return ok(res, setting);
});

/**
 * PUT /settings/:key
 * Actualiza el valor de una configuración existente
 */
router.put('/:key', adminOnly, (req, res, next) => {
  try {
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'value es requerido',
      });
    }

    db.prepare(`
      UPDATE settings
      SET value = ?, updated_at = datetime('now')
      WHERE key = ?
    `).run(String(value), req.params.key);

    const setting = db.prepare(`
      SELECT * FROM settings WHERE key = ?
    `).get(req.params.key);

    return ok(res, setting, 'Configuración actualizada');
  } catch (e) {
    next(e);
  }
});

/**
 * POST /settings
 * Crea una nueva configuración en el sistema
 */
router.post('/', adminOnly, (req, res, next) => {
  try {
    const { key, value, type, description } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'key y value son requeridos',
      });
    }

    db.prepare(`
      INSERT INTO settings (key, value, type, description)
      VALUES (?, ?, ?, ?)
    `).run(
      key,
      String(value),
      type || 'string',
      description || null
    );

    const setting = db.prepare(`
      SELECT * FROM settings WHERE key = ?
    `).get(key);

    return res.status(201).json({
      success: true,
      message: 'Configuración creada',
      data: setting,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;