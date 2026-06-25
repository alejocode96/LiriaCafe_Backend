// src/modules/reports/reports.repository.js
//
// ESTE ES EL ARCHIVO MÁS COMPLEJO DEL SISTEMA.
// Contiene queries de agregación avanzadas con Prisma.
//
// CONCEPTOS CLAVE DE PRISMA USADOS AQUÍ:
//
// aggregate: para SUM, COUNT, AVG, MAX, MIN
//   prisma.venta.aggregate({ _sum: { total: true }, _count: { id: true } })
//
// groupBy: para agrupar resultados
//   prisma.itemVenta.groupBy({ by: ['productoId'], _sum: { cantidad: true } })
//
// findMany con include: para JOINs
//   prisma.venta.findMany({ include: { items: { include: { producto: true } } } })
//
// ¿Por qué no usar SQL raw?
// Para mantener la compatibilidad con SQLite Y PostgreSQL.
// Prisma genera el SQL correcto para cada motor automáticamente.

import { prisma } from '../../config/database.js';

// ──────────────────────────────────────────────
// HELPER — Construir filtro de fechas
// ──────────────────────────────────────────────
const buildFechaWhere = (desde, hasta, campo = 'fechaVenta') => {
  if (!desde && !hasta) {
    // Por defecto: últimos 30 días
    const hace30dias = new Date();
    hace30dias.setDate(hace30dias.getDate() - 30);
    return { [campo]: { gte: hace30dias } };
  }
  const where = {};
  if (desde || hasta) {
    where[campo] = {};
    if (desde) where[campo].gte = new Date(desde);
    if (hasta) where[campo].lte = new Date(hasta);
  }
  return where;
};

// ──────────────────────────────────────────────
// REPORTE DE VENTAS
// ──────────────────────────────────────────────

export const getResumenVentas = async (where) => {
  const [completadas, anuladas, porMetodoPago] = await Promise.all([
    // Totales de ventas completadas
    prisma.venta.aggregate({
      where: { ...where, estado: 'COMPLETADA' },
      _sum: { total: true, descuentoTotal: true },
      _count: { id: true },
    }),
    // Cantidad de ventas anuladas
    prisma.venta.count({
      where: { ...where, estado: 'ANULADA' },
    }),
    // Desglose por método de pago
    prisma.venta.groupBy({
      by: ['metodoPago'],
      where: { ...where, estado: 'COMPLETADA' },
      _sum: { total: true },
      _count: { id: true },
    }),
  ]);

  return {
    totalVentas: completadas._sum.total ?? 0,
    cantidadVentas: completadas._count.id ?? 0,
    totalDescuentos: completadas._sum.descuentoTotal ?? 0,
    cantidadAnuladas: anuladas,
    porMetodoPago: porMetodoPago.map((m) => ({
      metodoPago: m.metodoPago,
      total: m._sum.total ?? 0,
      cantidad: m._count.id ?? 0,
    })),
  };
};

export const getTopProductos = async (where, limite = 10) => {
  // Agrupar ítems de venta por productoId para obtener el ranking
  const topItems = await prisma.itemVenta.groupBy({
    by: ['productoId'],
    where: {
      venta: { ...where, estado: 'COMPLETADA' },
    },
    _sum: { cantidad: true, subtotal: true },
    _count: { id: true },
    orderBy: { _sum: { cantidad: 'desc' } },
    take: parseInt(limite, 10),
  });

  // Enriquecer con nombres de productos
  const productoIds = topItems.map((i) => i.productoId);
  const productos = await prisma.producto.findMany({
    where: { id: { in: productoIds } },
    select: {
      id: true,
      nombre: true,
      precioBase: true,
      categoria: { select: { nombre: true } },
    },
  });
  const productosMap = Object.fromEntries(productos.map((p) => [p.id, p]));

  return topItems.map((item, index) => ({
    posicion: index + 1,
    productoId: item.productoId,
    nombre: productosMap[item.productoId]?.nombre ?? 'Desconocido',
    categoria: productosMap[item.productoId]?.categoria?.nombre ?? 'Sin categoría',
    unidadesVendidas: item._sum.cantidad ?? 0,
    ingresoGenerado: item._sum.subtotal ?? 0,
  }));
};

export const getVentasPorCajero = async (where) => {
  const porCajero = await prisma.venta.groupBy({
    by: ['cajeroId'],
    where: { ...where, estado: 'COMPLETADA' },
    _sum: { total: true },
    _count: { id: true },
    orderBy: { _sum: { total: 'desc' } },
  });

  const cajeroIds = porCajero.map((c) => c.cajeroId);
  const cajeros = await prisma.usuario.findMany({
    where: { id: { in: cajeroIds } },
    select: { id: true, nombreCompleto: true, nombreUsuario: true },
  });
  const cajerosMap = Object.fromEntries(cajeros.map((c) => [c.id, c]));

  return porCajero.map((c) => ({
    cajeroId: c.cajeroId,
    nombreCompleto: cajerosMap[c.cajeroId]?.nombreCompleto ?? 'Desconocido',
    nombreUsuario: cajerosMap[c.cajeroId]?.nombreUsuario ?? '',
    totalVentas: c._sum.total ?? 0,
    cantidadVentas: c._count.id ?? 0,
  }));
};

export const getVentasPorCategoria = async (where) => {
  // Esta query requiere pasar por itemVenta → producto → categoria
  const items = await prisma.itemVenta.findMany({
    where: { venta: { ...where, estado: 'COMPLETADA' } },
    select: {
      subtotal: true,
      cantidad: true,
      producto: {
        select: {
          categoriaId: true,
          categoria: { select: { id: true, nombre: true } },
        },
      },
    },
  });

  // Agrupar manualmente por categoría
  const porCategoria = {};
  for (const item of items) {
    const catId = item.producto.categoriaId;
    const catNombre = item.producto.categoria?.nombre ?? 'Sin categoría';
    if (!porCategoria[catId]) {
      porCategoria[catId] = {
        categoriaId: catId,
        categoriaNombre: catNombre,
        totalVentas: 0,
        unidadesVendidas: 0,
      };
    }
    porCategoria[catId].totalVentas += item.subtotal ?? 0;
    porCategoria[catId].unidadesVendidas += item.cantidad ?? 0;
  }

  return Object.values(porCategoria).sort((a, b) => b.totalVentas - a.totalVentas);
};

export const getVentasAnuladas = async (where) => {
  return prisma.venta.findMany({
    where: { ...where, estado: 'ANULADA' },
    select: {
      id: true,
      numero: true,
      total: true,
      fechaVenta: true,
      motivoAnulacion: true,
      cajero: { select: { nombreCompleto: true, nombreUsuario: true } },
    },
    orderBy: { fechaVenta: 'desc' },
    take: 50,
  });
};

// ──────────────────────────────────────────────
// REPORTE DE RENTABILIDAD
// ──────────────────────────────────────────────

/**
 * Calcula la rentabilidad usando el costoUnitarioSnapshot guardado en cada ítem.
 * Esto garantiza que el costo histórico del período se use correctamente.
 *
 * costoUnitarioSnapshot fue guardado al crear la venta con el costo promedio
 * del insumo EN ESE MOMENTO. Así podemos saber la rentabilidad histórica
 * aunque el costo del insumo haya cambiado posteriormente.
 */
export const getRentabilidadPorProducto = async (where, limite = 20) => {
  const items = await prisma.itemVenta.groupBy({
    by: ['productoId'],
    where: { venta: { ...where, estado: 'COMPLETADA' } },
    _sum: {
      subtotal: true,
      costoUnitarioSnapshot: true,
      cantidad: true,
    },
    _count: { id: true },
    orderBy: { _sum: { subtotal: 'desc' } },
    take: parseInt(limite, 10),
  });

  // Enriquecer con datos de productos
  const productoIds = items.map((i) => i.productoId);
  const productos = await prisma.producto.findMany({
    where: { id: { in: productoIds } },
    select: {
      id: true,
      nombre: true,
      precioBase: true,
      categoria: { select: { nombre: true } },
    },
  });
  const productosMap = Object.fromEntries(productos.map((p) => [p.id, p]));

  return items.map((item) => {
    const ingresoTotal = item._sum.subtotal ?? 0;
    const costoTotal = (item._sum.costoUnitarioSnapshot ?? 0) * (item._sum.cantidad ?? 0);
    const utilidadBruta = ingresoTotal - costoTotal;
    const margenPct = ingresoTotal > 0
      ? Math.round((utilidadBruta / ingresoTotal) * 10000) / 100
      : 0;

    return {
      productoId: item.productoId,
      nombre: productosMap[item.productoId]?.nombre ?? 'Desconocido',
      categoria: productosMap[item.productoId]?.categoria?.nombre ?? 'Sin categoría',
      unidadesVendidas: item._sum.cantidad ?? 0,
      ingresoTotal: Math.round(ingresoTotal * 100) / 100,
      costoTotal: Math.round(costoTotal * 100) / 100,
      utilidadBruta: Math.round(utilidadBruta * 100) / 100,
      margenPorcentaje: margenPct,
      esRentable: utilidadBruta > 0,
    };
  });
};

export const getRentabilidadPorVariante = async (where) => {
  const items = await prisma.itemVenta.groupBy({
    by: ['productoId', 'varianteId'],
    where: {
      venta: { ...where, estado: 'COMPLETADA' },
      varianteId: { not: null },
    },
    _sum: { subtotal: true, costoUnitarioSnapshot: true, cantidad: true },
    orderBy: { _sum: { subtotal: 'desc' } },
    take: 50,
  });

  const varianteIds = items.map((i) => i.varianteId).filter(Boolean);
  const variantes = await prisma.variante.findMany({
    where: { id: { in: varianteIds } },
    select: { id: true, nombre: true, precioDiferencial: true },
  });
  const variantesMap = Object.fromEntries(variantes.map((v) => [v.id, v]));

  const productoIds = [...new Set(items.map((i) => i.productoId))];
  const productos = await prisma.producto.findMany({
    where: { id: { in: productoIds } },
    select: { id: true, nombre: true },
  });
  const productosMap = Object.fromEntries(productos.map((p) => [p.id, p]));

  return items.map((item) => {
    const ingreso = item._sum.subtotal ?? 0;
    const costo = (item._sum.costoUnitarioSnapshot ?? 0) * (item._sum.cantidad ?? 0);
    const utilidad = ingreso - costo;
    return {
      productoNombre: productosMap[item.productoId]?.nombre ?? 'Desconocido',
      varianteNombre: variantesMap[item.varianteId]?.nombre ?? 'Sin variante',
      unidades: item._sum.cantidad ?? 0,
      ingreso: Math.round(ingreso * 100) / 100,
      costo: Math.round(costo * 100) / 100,
      utilidad: Math.round(utilidad * 100) / 100,
      margen: ingreso > 0 ? Math.round((utilidad / ingreso) * 10000) / 100 : 0,
    };
  });
};

// ──────────────────────────────────────────────
// REPORTE DE INVENTARIO
// ──────────────────────────────────────────────

export const getEstadoInventario = async (where) => {
  const items = await prisma.itemInventario.findMany({
    where,
    select: {
      id: true,
      nombre: true,
      unidadMedida: true,
      stockActual: true,
      stockMinimo: true,
      costoPromedio: true,
      estado: true,
      updatedAt: true,
    },
    orderBy: { nombre: 'asc' },
  });

  return items.map((item) => ({
    ...item,
    valorInventario: Math.round(item.stockActual * item.costoPromedio * 100) / 100,
    alertaStockMinimo: item.stockActual <= item.stockMinimo,
    stockCritico: item.stockActual === 0,
  }));
};

export const getResumenInventario = async () => {
  const [total, activos, bajoMinimo, sinStock, valorTotal] = await Promise.all([
    prisma.itemInventario.count(),
    prisma.itemInventario.count({ where: { estado: 'ACTIVO' } }),
    // Bajo mínimo: stockActual <= stockMinimo pero > 0
    prisma.itemInventario.findMany({
      where: { estado: 'ACTIVO' },
      select: { stockActual: true, stockMinimo: true, costoPromedio: true },
    }),
    prisma.itemInventario.count({ where: { stockActual: 0, estado: 'ACTIVO' } }),
    prisma.itemInventario.aggregate({
      where: { estado: 'ACTIVO' },
      _sum: { stockActual: true },
    }),
  ]);

  const itemsBajoMinimo = bajoMinimo.filter((i) => i.stockActual <= i.stockMinimo && i.stockActual > 0);
  const valorTotalInventario = bajoMinimo.reduce((acc, i) => acc + (i.stockActual * i.costoPromedio), 0);

  return {
    totalItems: total,
    itemsActivos: activos,
    itemsBajoMinimo: itemsBajoMinimo.length,
    itemsSinStock: sinStock,
    valorTotalInventario: Math.round(valorTotalInventario * 100) / 100,
  };
};

export const getConsumoInsumos = async (donde, hasta) => {
  // Movimientos tipo CONSUMO en el período
  const consumos = await prisma.movimientoInventario.groupBy({
    by: ['itemId'],
    where: {
      tipo: 'CONSUMO',
      createdAt: {
        ...(donde && { gte: new Date(donde) }),
        ...(hasta && { lte: new Date(hasta) }),
      },
    },
    _sum: { cantidad: true },
    orderBy: { _sum: { cantidad: 'desc' } },
    take: 20,
  });

  const itemIds = consumos.map((c) => c.itemId);
  const items = await prisma.itemInventario.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, nombre: true, unidadMedida: true, costoPromedio: true },
  });
  const itemsMap = Object.fromEntries(items.map((i) => [i.id, i]));

  return consumos.map((c) => ({
    itemId: c.itemId,
    nombre: itemsMap[c.itemId]?.nombre ?? 'Desconocido',
    unidadMedida: itemsMap[c.itemId]?.unidadMedida ?? '',
    cantidadConsumida: c._sum.cantidad ?? 0,
    costoConsumo: Math.round((c._sum.cantidad ?? 0) * (itemsMap[c.itemId]?.costoPromedio ?? 0) * 100) / 100,
  }));
};

// ──────────────────────────────────────────────
// REPORTE DE CAJA Y FLUJO
// ──────────────────────────────────────────────

export const getCierresCaja = async (where) => {
  return prisma.caja.findMany({
    where: { ...where, estado: 'CERRADA' },
    include: {
      abiertaPor: { select: { nombreCompleto: true, nombreUsuario: true } },
      cerradaPor: { select: { nombreCompleto: true, nombreUsuario: true } },
      _count: { select: { ventas: true, movimientos: true } },
    },
    orderBy: { fechaApertura: 'desc' },
    take: 30,
  });
};

export const getResumenCajas = async (where) => {
  const [cajas, ventasPeriodo, ingresosFlujo, egresosFlujo] = await Promise.all([
    prisma.caja.count({ where }),
    prisma.venta.aggregate({
      where: {
        caja: where,
        estado: 'COMPLETADA',
      },
      _sum: { total: true },
      _count: { id: true },
    }),
    prisma.movimientoCaja.aggregate({
      where: { caja: where, tipo: 'INGRESO', afectaCaja: true },
      _sum: { monto: true },
    }),
    prisma.movimientoCaja.aggregate({
      where: {
        caja: where,
        tipo: { in: ['EGRESO', 'COMPRA_INVENTARIO'] },
        afectaCaja: true,
      },
      _sum: { monto: true },
    }),
  ]);

  const totalVentas = ventasPeriodo._sum.total ?? 0;
  const totalIngresos = ingresosFlujo._sum.monto ?? 0;
  const totalEgresos = egresosFlujo._sum.monto ?? 0;
  const balanceOperativo = totalVentas + totalIngresos - totalEgresos;

  return {
    cantidadCajas: cajas,
    totalVentas: Math.round(totalVentas * 100) / 100,
    cantidadVentas: ventasPeriodo._count.id ?? 0,
    totalIngresosFlujo: Math.round(totalIngresos * 100) / 100,
    totalEgresosFlujo: Math.round(totalEgresos * 100) / 100,
    balanceOperativo: Math.round(balanceOperativo * 100) / 100,
  };
};

// ──────────────────────────────────────────────
// DASHBOARD — Resumen ejecutivo
// ──────────────────────────────────────────────

export const getDashboardData = async (desde, hasta) => {
  const fechaWhere = buildFechaWhere(desde, hasta);
  const fechaWhereCaja = buildFechaWhere(desde, hasta, 'fechaApertura');
  const fechaWhereCreatedAt = buildFechaWhere(desde, hasta, 'createdAt');

  const [
    ventasHoy,
    topProducto,
    itemsSinStock,
    cajaActual,
    ultimosMovimientos,
  ] = await Promise.all([
    // Ventas totales del período
    prisma.venta.aggregate({
      where: { ...fechaWhere, estado: 'COMPLETADA' },
      _sum: { total: true },
      _count: { id: true },
    }),
    // Producto más vendido del período
    prisma.itemVenta.groupBy({
      by: ['productoId'],
      where: { venta: { ...fechaWhere, estado: 'COMPLETADA' } },
      _sum: { cantidad: true },
      orderBy: { _sum: { cantidad: 'desc' } },
      take: 1,
    }),
    // Ítems sin stock
    prisma.itemInventario.count({ where: { stockActual: 0, estado: 'ACTIVO' } }),
    // Estado de la caja actual
    prisma.caja.findFirst({
      where: { estado: 'ABIERTA' },
      select: { id: true, estado: true, montoInicial: true, fechaApertura: true },
    }),
    // Últimos 5 movimientos de flujo de caja
    prisma.movimientoCaja.findMany({
      where: fechaWhereCreatedAt,
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { tipo: true, monto: true, concepto: true, createdAt: true, medioPago: true },
    }),
  ]);

  // Enriquecer top producto con nombre
  let topProductoNombre = null;
  if (topProducto.length > 0) {
    const prod = await prisma.producto.findUnique({
      where: { id: topProducto[0].productoId },
      select: { nombre: true },
    });
    topProductoNombre = {
      nombre: prod?.nombre ?? 'Desconocido',
      unidades: topProducto[0]._sum.cantidad ?? 0,
    };
  }

  return {
    ventas: {
      totalMonto: Math.round((ventasHoy._sum.total ?? 0) * 100) / 100,
      cantidadTransacciones: ventasHoy._count.id ?? 0,
    },
    topProducto: topProductoNombre,
    alertas: {
      itemsSinStock,
    },
    caja: cajaActual
      ? { estado: cajaActual.estado, desde: cajaActual.fechaApertura }
      : { estado: 'CERRADA', desde: null },
    ultimosMovimientosFlujo: ultimosMovimientos,
    periodoCubierto: {
      desde: desde ?? 'últimos 30 días',
      hasta: hasta ?? 'ahora',
    },
  };
};