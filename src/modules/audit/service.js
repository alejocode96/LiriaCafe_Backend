// backend/src/modules/audit/service.js
// ─────────────────────────────────────────────────────────────
// Servicio central de auditoría del sistema
// Registra eventos críticos para trazabilidad, seguridad y control
// ─────────────────────────────────────────────────────────────

const db = require('../../config/db');
const logger = require('../../config/logger');

/**
 * Registra una acción del sistema en la tabla audit_logs.
 *
 * Este servicio es de tipo "fire-and-forget":
 * - Nunca debe romper el flujo principal del sistema
 * - Si falla, solo registra el error en logs internos
 *
 * Se utiliza para:
 * - Creaciones, actualizaciones y eliminaciones
 * - Acciones sensibles (ventas, caja, inventario)
 * - Trazabilidad de usuarios en el sistema
 *
 * @param {Object} params
 * @param {number} [params.userId] - ID del usuario que ejecuta la acción
 * @param {string} params.action - Acción realizada (CREATE, UPDATE, DELETE, LOGIN, etc.)
 * @param {string} params.module - Módulo afectado (users, products, orders, etc.)
 * @param {number|string} [params.targetId] - ID del registro afectado
 * @param {Object} [params.payload] - Información adicional del evento (se guarda como JSON)
 * @param {string} [params.ip] - Dirección IP del usuario
 * @param {string} [params.userAgent] - Navegador o cliente utilizado
 *
 * @returns {void}
 */
const logAudit = async ({
  userId,
  action,
  module,
  targetId,
  payload,
  ip,
  userAgent
}) => {
  try {
    db.prepare(`
      INSERT INTO audit_logs (
        user_id,
        action,
        module,
        target_id,
        payload,
        ip_address,
        user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId || null,
      action,
      module,
      targetId || null,
      payload ? JSON.stringify(payload) : null,
      ip || null,
      userAgent || null,
    );
  } catch (error) {
    // Auditoría nunca debe bloquear operaciones del sistema
    // Se registra el error para análisis posterior
    logger.error('Error registrando auditoría:', error);
  }
};

module.exports = { logAudit };