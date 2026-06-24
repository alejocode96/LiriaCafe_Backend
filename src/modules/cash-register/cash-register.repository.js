// src/modules/cash-register/cash-register.repository.js
//
// PATRÓN IMPORTANTE — Consulta de caja activa:
// findCajaAbierta es la consulta más crítica del módulo.
// Se llama antes de abrir (para evitar duplicados), antes de cerrar
// (para saber qué caja cerrar), y en el módulo de ventas (para
// asociar cada venta a la caja del momento).
//
// Por eso debe ser rápida y confiable. En PostgreSQL se puede
// agregar un índice parcial: CREATE UNIQUE INDEX ON cajas (estado)
// WHERE estado = 'ABIERTA'; — garantiza unicidad a nivel de BD.

import { prisma } from '../../config/database.js';

// ──────────────────────────────────────────────
// CONSULTAS COMPARTIDAS — usadas por múltiples endpoints
// ──────────────────────────────────────────────

/**
 * Busca la caja actualmente abierta.
 * Retorna null si no hay ninguna abierta.
 * Es la consulta más importante del módulo.
 */
export const findCajaAbierta = async () => {
  return prisma.caja.findFirst({
    where: { estado: 'ABIERTA' },
    include: {
      abiertaPor: {
        select: {
          id: true,
          nombreCompleto: true,
          nombreUsuario: true,
        },
      },
    },
  });
};

// ──────────────────────────────────────────────
// PARA: POST /cash-register/open
// ──────────────────────────────────────────────

/**
 * Crea una nueva caja en estado ABIERTA.
 */
export const createCaja = async ({ montoInicial, notas, abiertaPorId }) => {
  return prisma.caja.create({
    data: {
      montoInicial,
      estado: 'ABIERTA',
      fechaApertura: new Date(),
      abiertaPorId,
    },
    include: {
      abiertaPor: {
        select: {
          id: true,
          nombreCompleto: true,
          nombreUsuario: true,
        },
      },
    },
  });
};

// ──────────────────────────────────────────────
// PARA: GET /cash-register/current
// ──────────────────────────────────────────────

/**
 * Calcula el resumen financiero de la caja activa.
 * Suma ventas por método de pago usando agregaciones de Prisma.
 *
 * ¿Por qué usar aggregate en lugar de traer todas las ventas?
 * Si el negocio procesó 200 ventas en el día, traerlas todas para
 * sumarlas en JavaScript sería ineficiente. Dejamos que la BD
 * haga la suma con SQL — es para lo que está optimizada.
 */
export const calcularResumenCaja = async (cajaId) => {
  // Suma de ventas en efectivo (solo ventas completadas, no anuladas)
  const ventasEfectivo = await prisma.venta.aggregate({
    where: {
      cajaId,
      estado: 'COMPLETADA',
      metodoPago: { in: ['EFECTIVO', 'COMBINADO'] },
    },
    _sum: { montoEfectivo: true },
    _count: { id: true },
  });

  // Suma de ventas por transferencia
  const ventasTransferencia = await prisma.venta.aggregate({
    where: {
      cajaId,
      estado: 'COMPLETADA',
      metodoPago: { in: ['TRANSFERENCIA', 'COMBINADO'] },
    },
    _sum: { montoTransferencia: true },
  });

  // Total de ventas (todas las completadas)
  const totalVentas = await prisma.venta.aggregate({
    where: { cajaId, estado: 'COMPLETADA' },
    _sum: { total: true },
    _count: { id: true },
  });

  // Ventas anuladas (para transparencia)
  const ventasAnuladas = await prisma.venta.count({
    where: { cajaId, estado: 'ANULADA' },
  });

  const totalEfectivo = ventasEfectivo._sum.montoEfectivo ?? 0;
  const totalTransferencias = ventasTransferencia._sum.montoTransferencia ?? 0;

  return {
    totalVentas: totalVentas._sum.total ?? 0,
    cantidadVentas: totalVentas._count.id ?? 0,
    cantidadVentasAnuladas: ventasAnuladas,
    totalEfectivo,
    totalTransferencias,
  };
};

// ──────────────────────────────────────────────
// PARA: POST /cash-register/close
// ──────────────────────────────────────────────

/**
 * Cierra la caja con todos los datos del cuadre.
 * Una vez cerrada, la caja es inmutable.
 */
export const cerrarCaja = async ({
  cajaId,
  conteoFisicoEfectivo,
  conteoTransferencias,
  saldoEsperado,
  diferencia,
  notasCierre,
  cerradaPorId,
}) => {
  return prisma.caja.update({
    where: { id: cajaId },
    data: {
      estado: 'CERRADA',
      fechaCierre: new Date(),
      conteoFisicoEfectivo,
      conteoTransferencias,
      saldoEsperado,
      diferencia,
      notasCierre,
      cerradaPorId,
    },
    include: {
      abiertaPor: {
        select: { id: true, nombreCompleto: true, nombreUsuario: true },
      },
      cerradaPor: {
        select: { id: true, nombreCompleto: true, nombreUsuario: true },
      },
    },
  });
};

// ──────────────────────────────────────────────
// PARA: GET /cash-register/history
// ──────────────────────────────────────────────

export const countCajas = async (where) => {
  return prisma.caja.count({ where });
};

export const findCajas = async ({ where, skip, take }) => {
  return prisma.caja.findMany({
    where,
    skip,
    take,
    include: {
      abiertaPor: {
        select: { id: true, nombreCompleto: true, nombreUsuario: true },
      },
      cerradaPor: {
        select: { id: true, nombreCompleto: true, nombreUsuario: true },
      },
      _count: { select: { ventas: true, movimientos: true } },
    },
    orderBy: { fechaApertura: 'desc' },
  });
};

// ──────────────────────────────────────────────
// PARA: GET /cash-register/:id
// ──────────────────────────────────────────────

export const findCajaById = async (id) => {
  return prisma.caja.findUnique({
    where: { id },
    include: {
      abiertaPor: {
        select: { id: true, nombreCompleto: true, nombreUsuario: true },
      },
      cerradaPor: {
        select: { id: true, nombreCompleto: true, nombreUsuario: true },
      },
      _count: { select: { ventas: true, movimientos: true } },
    },
  });
};