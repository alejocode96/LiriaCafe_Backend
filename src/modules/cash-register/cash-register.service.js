// src/modules/cash-register/cash-register.service.js
//
// CONCEPTO CLAVE — Saldo Esperado:
// Al cerrar la caja, el sistema calcula cuánto debería haber:
//
// Saldo esperado en efectivo =
//   montoInicial (base de caja al abrir)
//   + total ventas en efectivo del día
//   + ingresos de flujo de caja en efectivo (Fase 8)
//   - egresos de flujo de caja en efectivo (Fase 8)
//
// En esta Fase 6, lo simplificamos a:
//   saldoEsperado = montoInicial + totalEfectivo
//
// En la Fase 8 (flujo de caja) se agregará la lógica de
// ingresos y egresos al cálculo del saldo esperado.
//
// Diferencia = conteoFisicoEfectivo - saldoEsperado
//   > 0 = SOBRANTE (el cajero tiene más dinero del esperado)
//   < 0 = FALTANTE (el cajero tiene menos dinero del esperado)
//   = 0 = CUADRE PERFECTO

import * as cashRegisterRepository from './cash-register.repository.js';
import { registrarAuditoria } from '../../middlewares/audit.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import { logger } from '../../logger/index.js';

// ──────────────────────────────────────────────
// ABRIR CAJA
// ──────────────────────────────────────────────
export const abrirCaja = async ({ montoInicial, notas }, usuarioId) => {

  // REGLA 1: Solo puede haber una caja abierta a la vez
  const cajaExistente = await cashRegisterRepository.findCajaAbierta();
  if (cajaExistente) {
    throw new ConflictError(
      `Ya existe una caja abierta desde ${new Date(cajaExistente.fechaApertura).toLocaleString('es-CO')}. ` +
      `Fue abierta por ${cajaExistente.abiertaPor.nombreCompleto}. ` +
      `Debes cerrar esa caja antes de abrir una nueva.`
    );
  }

  const caja = await cashRegisterRepository.createCaja({
    montoInicial,
    notas,
    abiertaPorId: usuarioId,
  });

  await registrarAuditoria({
    accion: 'APERTURA_CAJA',
    usuarioId,
    entidad: 'Caja',
    entidadId: caja.id,
    detalle: { montoInicial, fechaApertura: caja.fechaApertura },
  });

  logger.info('Caja abierta', {
    cajaId: caja.id,
    montoInicial,
    usuarioId,
  });

  return caja;
};

// ──────────────────────────────────────────────
// VER CAJA ACTUAL (estado en tiempo real)
// ──────────────────────────────────────────────
export const verCajaActual = async () => {
  const caja = await cashRegisterRepository.findCajaAbierta();

  if (!caja) {
    throw new NotFoundError(
      'No hay ninguna caja abierta en este momento. Abre una caja para comenzar el turno.'
    );
  }

  // Calcular el resumen financiero en tiempo real
  const resumen = await cashRegisterRepository.calcularResumenCaja(caja.id);

  // Saldo proyectado = base inicial + ventas en efectivo del día
  // (En Fase 8 se agregarán ingresos y egresos de flujo de caja)
  const saldoProyectado = caja.montoInicial + resumen.totalEfectivo;

  return {
    caja: {
      id: caja.id,
      estado: caja.estado,
      montoInicial: caja.montoInicial,
      fechaApertura: caja.fechaApertura,
      abiertaPor: caja.abiertaPor,
    },
    resumen: {
      ...resumen,
      saldoProyectadoEfectivo: Math.round(saldoProyectado * 100) / 100,
    },
  };
};

// ──────────────────────────────────────────────
// ESTADO DE LA CAJA (público — para el sistema)
// ──────────────────────────────────────────────
/**
 * Versión simplificada de verCajaActual.
 * Usada internamente por el módulo de ventas para verificar
 * si se puede vender antes de procesar una transacción.
 * Solo retorna si hay caja abierta y su ID.
 */
export const obtenerEstadoCaja = async () => {
  const caja = await cashRegisterRepository.findCajaAbierta();

  return {
    hayTCajaAbierta: !!caja,
    cajaId: caja?.id ?? null,
    estado: caja?.estado ?? null,
    fechaApertura: caja?.fechaApertura ?? null,
  };
};

// ──────────────────────────────────────────────
// CERRAR CAJA
// ──────────────────────────────────────────────
export const cerrarCaja = async (
  { conteoFisicoEfectivo, conteoTransferencias, notasCierre },
  usuarioId
) => {
  // REGLA 1: Debe haber una caja abierta para cerrar
  const caja = await cashRegisterRepository.findCajaAbierta();
  if (!caja) {
    throw new NotFoundError(
      'No hay ninguna caja abierta para cerrar.'
    );
  }

  // Calcular el resumen del día para el cuadre
  const resumen = await cashRegisterRepository.calcularResumenCaja(caja.id);

  // CÁLCULO DEL CUADRE:
  // El saldo esperado en efectivo es:
  //   monto inicial + total ventas en efectivo del día
  // En Fase 8 se agregarán movimientos de flujo de caja
  const saldoEsperadoEfectivo = caja.montoInicial + resumen.totalEfectivo;

  // La diferencia puede ser positiva (sobrante) o negativa (faltante)
  const diferenciaEfectivo = conteoFisicoEfectivo - saldoEsperadoEfectivo;
  const diferenciaTransferencias = conteoTransferencias - resumen.totalTransferencias;

  // El saldo esperado total = esperado efectivo + esperado transferencias
  const saldoEsperadoTotal = saldoEsperadoEfectivo + resumen.totalTransferencias;
  const diferenciaTotal = diferenciaEfectivo + diferenciaTransferencias;

  const cajaC = await cashRegisterRepository.cerrarCaja({
    cajaId: caja.id,
    conteoFisicoEfectivo,
    conteoTransferencias,
    saldoEsperado: saldoEsperadoTotal,
    diferencia: diferenciaTotal,
    notasCierre,
    cerradaPorId: usuarioId,
  });

  // Determinar si hubo diferencia para el log y la auditoría
  const tieneDiferencia = Math.abs(diferenciaTotal) > 0;
  const tipoDiferencia = diferenciaTotal > 0 ? 'SOBRANTE' : diferenciaTotal < 0 ? 'FALTANTE' : 'CUADRE_PERFECTO';

  await registrarAuditoria({
    accion: 'CIERRE_CAJA',
    usuarioId,
    entidad: 'Caja',
    entidadId: caja.id,
    detalle: {
      montoInicial: caja.montoInicial,
      totalVentas: resumen.totalVentas,
      cantidadVentas: resumen.cantidadVentas,
      saldoEsperado: saldoEsperadoTotal,
      conteoFisicoEfectivo,
      conteoTransferencias,
      diferencia: diferenciaTotal,
      tipoDiferencia,
    },
  });

  logger.info('Caja cerrada', {
    cajaId: caja.id,
    tipoDiferencia,
    diferencia: diferenciaTotal,
    usuarioId,
  });

  // Alerta si hay diferencia significativa (más de $1.000)
  if (tieneDiferencia && Math.abs(diferenciaTotal) > 1000) {
    logger.warn('⚠️  Diferencia de caja significativa detectada', {
      cajaId: caja.id,
      diferencia: diferenciaTotal,
      tipoDiferencia,
    });
  }

  return {
    caja: cajaC,
    resumen: {
      ...resumen,
      saldoEsperadoEfectivo: Math.round(saldoEsperadoEfectivo * 100) / 100,
      saldoEsperadoTotal: Math.round(saldoEsperadoTotal * 100) / 100,
      diferenciaEfectivo: Math.round(diferenciaEfectivo * 100) / 100,
      diferenciaTransferencias: Math.round(diferenciaTransferencias * 100) / 100,
      diferenciaTotal: Math.round(diferenciaTotal * 100) / 100,
      tipoDiferencia,
    },
  };
};

// ──────────────────────────────────────────────
// HISTORIAL DE CAJAS
// ──────────────────────────────────────────────
export const historialCajas = async (query) => {
  const { page, limit, skip } = parsePagination(query);

  const where = {};

  if (query.estado) where.estado = query.estado;

  // Filtros por rango de fechas
  if (query.desde || query.hasta) {
    where.fechaApertura = {};
    if (query.desde) where.fechaApertura.gte = new Date(query.desde);
    if (query.hasta) where.fechaApertura.lte = new Date(query.hasta);
  }

  const [total, cajas] = await Promise.all([
    cashRegisterRepository.countCajas(where),
    cashRegisterRepository.findCajas({ where, skip, take: limit }),
  ]);

  return {
    cajas,
    meta: buildPaginationMeta(total, page, limit),
  };
};

// ──────────────────────────────────────────────
// VER CAJA POR ID (historial detallado)
// ──────────────────────────────────────────────
export const verCaja = async (id) => {
  const caja = await cashRegisterRepository.findCajaById(id);

  if (!caja) {
    throw new NotFoundError(`No se encontró la caja con ID: ${id}`);
  }

  // Si está cerrada, calcular el resumen histórico
  const resumen = await cashRegisterRepository.calcularResumenCaja(id);

  return {
    caja,
    resumen,
  };
};