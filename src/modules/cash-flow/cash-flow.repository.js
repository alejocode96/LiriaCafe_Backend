// src/modules/cash-flow/cash-flow.repository.js
//
// ¿Por qué las categorías de movimiento son un recurso separado?
// Porque permiten extensibilidad sin modificar código.
// El administrador puede agregar "Comisiones de tarjeta",
// "Gastos de transporte", etc. sin tocar el sistema.
// Los reportes se agrupan por estas categorías automáticamente.

import { prisma } from '../../config/database.js';

// ──────────────────────────────────────────────
// CATEGORÍAS DE MOVIMIENTO
// ──────────────────────────────────────────────

export const findCategoriaMoyByNombre = async (nombre, excluirId = null) => {
  return prisma.categoriaMovimiento.findFirst({
    where: {
      nombre: { contains: nombre },
      ...(excluirId && { NOT: { id: excluirId } }),
    },
  });
};

export const createCategoriaMov = async ({ nombre, descripcion }) => {
  return prisma.categoriaMovimiento.create({
    data: { nombre, descripcion, estado: 'ACTIVO' },
  });
};

export const findCategoriasMov = async ({ where, skip, take }) => {
  return prisma.categoriaMovimiento.findMany({
    where,
    skip,
    take,
    include: {
      _count: { select: { movimientos: true } },
    },
    orderBy: { nombre: 'asc' },
  });
};

export const countCategoriasMov = async (where) => {
  return prisma.categoriaMovimiento.count({ where });
};

export const findCategoriaMovById = async (id) => {
  return prisma.categoriaMovimiento.findUnique({
    where: { id },
    include: { _count: { select: { movimientos: true } } },
  });
};

export const cambiarEstadoCategoriaMov = async (id, estado) => {
  return prisma.categoriaMovimiento.update({
    where: { id },
    data: { estado },
  });
};

// ──────────────────────────────────────────────
// MOVIMIENTOS DE FLUJO DE CAJA
// ──────────────────────────────────────────────

/**
 * Busca la caja actualmente abierta.
 * Duplicado aquí para no acoplar módulos entre sí.
 */
export const findCajaAbierta = async () => {
  return prisma.caja.findFirst({
    where: { estado: 'ABIERTA' },
    select: { id: true, estado: true },
  });
};

/**
 * Crea el movimiento de flujo de caja.
 * Si es COMPRA_INVENTARIO, crea también la entrada de inventario
 * en una transacción atómica.
 */
export const createMovimiento = async ({
  tipo,
  monto,
  concepto,
  categoriaId,
  medioPago,
  afectaCaja,
  notas,
  cajaId,
  usuarioId,
  // Para COMPRA_INVENTARIO
  itemInventarioId,
  cantidadInventario,
  costoPromedioActual,
  stockActualItem,
}) => {
  return prisma.$transaction(async (tx) => {

    // 1. Crear el movimiento de flujo de caja
    const movimiento = await tx.movimientoCaja.create({
      data: {
        tipo,
        monto,
        concepto,
        categoriaId: categoriaId ?? null,
        medioPago,
        afectaCaja,
        notas: notas ?? null,
        cajaId,
        usuarioId,
      },
      include: {
        categoria: { select: { id: true, nombre: true } },
        usuario: { select: { id: true, nombreCompleto: true, nombreUsuario: true } },
        caja: { select: { id: true, estado: true, fechaApertura: true } },
      },
    });

    // 2. Si es COMPRA_INVENTARIO, crear la entrada de inventario
    // y actualizar el stock + costo promedio del ítem
    if (tipo === 'COMPRA_INVENTARIO' && itemInventarioId && cantidadInventario) {
      const precioUnitario = monto / cantidadInventario;

      // Calcular nuevo costo promedio ponderado
      const valorActual = (stockActualItem ?? 0) * (costoPromedioActual ?? 0);
      const valorNueva = cantidadInventario * precioUnitario;
      const nuevoStock = (stockActualItem ?? 0) + cantidadInventario;
      const nuevoCostoProm = nuevoStock > 0
        ? (valorActual + valorNueva) / nuevoStock
        : precioUnitario;

      // Crear la entrada de inventario vinculada al movimiento
      const entrada = await tx.entradaInventario.create({
        data: {
          itemId: itemInventarioId,
          cantidad: cantidadInventario,
          precioUnitario,
          precioTotal: monto,
          proveedor: concepto,
          notas,
          usuarioId,
          movimientoCajaId: movimiento.id,
        },
      });

      // Actualizar stock y costo promedio del ítem
      await tx.itemInventario.update({
        where: { id: itemInventarioId },
        data: {
          stockActual: nuevoStock,
          costoPromedio: Math.round(nuevoCostoProm * 100) / 100,
        },
      });

      // Registrar en el Kardex
      await tx.movimientoInventario.create({
        data: {
          itemId: itemInventarioId,
          tipo: 'ENTRADA',
          cantidad: cantidadInventario,
          stockAntes: stockActualItem ?? 0,
          stockDespues: nuevoStock,
          motivo: `Compra registrada en flujo de caja. Concepto: ${concepto}`,
          referencia: entrada.id,
        },
      });
    }

    return movimiento;
  });
};

export const countMovimientos = async (where) => {
  return prisma.movimientoCaja.count({ where });
};

export const findMovimientos = async ({ where, skip, take }) => {
  return prisma.movimientoCaja.findMany({
    where,
    skip,
    take,
    include: {
      categoria: { select: { id: true, nombre: true } },
      usuario: { select: { id: true, nombreCompleto: true, nombreUsuario: true } },
      caja: { select: { id: true, fechaApertura: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const findMovimientoById = async (id) => {
  return prisma.movimientoCaja.findUnique({
    where: { id },
    include: {
      categoria: { select: { id: true, nombre: true } },
      usuario: { select: { id: true, nombreCompleto: true, nombreUsuario: true } },
      caja: { select: { id: true, fechaApertura: true, estado: true } },
    },
  });
};

// ──────────────────────────────────────────────
// RESUMEN FINANCIERO
// ──────────────────────────────────────────────

/**
 * Calcula el resumen financiero del período.
 * Usa aggregate de Prisma para sumar por tipo en una sola query.
 */
export const calcularResumenFinanciero = async (where) => {
  const [ingresos, egresos, comprasInventario, totalMovimientos] = await Promise.all([
    prisma.movimientoCaja.aggregate({
      where: { ...where, tipo: 'INGRESO' },
      _sum: { monto: true },
      _count: { id: true },
    }),
    prisma.movimientoCaja.aggregate({
      where: { ...where, tipo: 'EGRESO' },
      _sum: { monto: true },
      _count: { id: true },
    }),
    prisma.movimientoCaja.aggregate({
      where: { ...where, tipo: 'COMPRA_INVENTARIO' },
      _sum: { monto: true },
      _count: { id: true },
    }),
    prisma.movimientoCaja.count({ where }),
  ]);

  // Desglose por categoría (top 10 más usadas)
  const porCategoria = await prisma.movimientoCaja.groupBy({
    by: ['categoriaId', 'tipo'],
    where,
    _sum: { monto: true },
    _count: { id: true },
    orderBy: { _sum: { monto: 'desc' } },
    take: 10,
  });

  // Desglose por medio de pago
  const porMedioPago = await prisma.movimientoCaja.groupBy({
    by: ['medioPago', 'tipo'],
    where,
    _sum: { monto: true },
    _count: { id: true },
  });

  const totalIngresos = ingresos._sum.monto ?? 0;
  const totalEgresos = (egresos._sum.monto ?? 0) + (comprasInventario._sum.monto ?? 0);
  const balance = totalIngresos - totalEgresos;

  return {
    totalIngresos,
    cantidadIngresos: ingresos._count.id ?? 0,
    totalEgresos: egresos._sum.monto ?? 0,
    cantidadEgresos: egresos._count.id ?? 0,
    totalComprasInventario: comprasInventario._sum.monto ?? 0,
    cantidadCompras: comprasInventario._count.id ?? 0,
    totalEgresosConCompras: totalEgresos,
    balance,
    totalMovimientos,
    porCategoria,
    porMedioPago,
  };
};