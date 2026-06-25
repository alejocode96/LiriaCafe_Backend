// src/modules/reports/reports.service.js
//
// El servicio de reportes coordina múltiples queries del repositorio
// y las ensambla en una respuesta coherente.
// No hay lógica de negocio compleja — principalmente orquestación.

import * as reportsRepository from './reports.repository.js';
import { logger } from '../../logger/index.js';

// Helper para construir filtro de fechas con valores por defecto
const buildDateFilter = (desde, hasta, campo = 'fechaVenta') => {
  if (!desde && !hasta) {
    const hace30dias = new Date();
    hace30dias.setDate(hace30dias.getDate() - 30);
    return { [campo]: { gte: hace30dias } };
  }
  const filter = {};
  if (desde || hasta) {
    filter[campo] = {};
    if (desde) filter[campo].gte = new Date(desde);
    if (hasta) filter[campo].lte = new Date(hasta);
  }
  return filter;
};

// ──────────────────────────────────────────────
// REPORTE DE VENTAS
// ──────────────────────────────────────────────
export const reporteVentas = async (query) => {
  const { desde, hasta, cajeroId, cajaId, categoriaId, metodoPago, incluirAnuladas, topProductos } = query;

  const where = buildDateFilter(desde, hasta);
  if (cajeroId) where.cajeroId = cajeroId;
  if (cajaId) where.cajaId = cajaId;
  if (metodoPago) where.metodoPago = metodoPago;

  const [resumen, topProductosList, porCajero, porCategoria, anuladas] = await Promise.all([
    reportsRepository.getResumenVentas(where),
    reportsRepository.getTopProductos(where, topProductos),
    reportsRepository.getVentasPorCajero(where),
    reportsRepository.getVentasPorCategoria(where),
    incluirAnuladas === 'true' ? reportsRepository.getVentasAnuladas(where) : Promise.resolve([]),
  ]);

  logger.info('Reporte de ventas generado', { desde, hasta, cajeroId });

  return {
    resumen,
    topProductos: topProductosList,
    porCajero,
    porCategoria,
    ventasAnuladas: anuladas,
    filtrosAplicados: { desde, hasta, cajeroId, cajaId, metodoPago },
    generadoEn: new Date().toISOString(),
  };
};

// ──────────────────────────────────────────────
// REPORTE DE RENTABILIDAD
// ──────────────────────────────────────────────
export const reporteRentabilidad = async (query) => {
  const { desde, hasta, categoriaId, productoId, limite } = query;

  const where = buildDateFilter(desde, hasta);
  if (categoriaId) where.cajeroId = categoriaId; // Filtro por cajero como proxy

  const [porProducto, porVariante] = await Promise.all([
    reportsRepository.getRentabilidadPorProducto(where, limite),
    reportsRepository.getRentabilidadPorVariante(where),
  ]);

  // Filtrar por productoId si se especificó
  const productosFiltrados = productoId
    ? porProducto.filter((p) => p.productoId === productoId)
    : porProducto;

  // Calcular totales del reporte
  const totalIngreso = productosFiltrados.reduce((acc, p) => acc + p.ingresoTotal, 0);
  const totalCosto = productosFiltrados.reduce((acc, p) => acc + p.costoTotal, 0);
  const totalUtilidad = totalIngreso - totalCosto;
  const margenGlobal = totalIngreso > 0
    ? Math.round((totalUtilidad / totalIngreso) * 10000) / 100
    : 0;

  const productosNegativoS = productosFiltrados.filter((p) => !p.esRentable);

  logger.info('Reporte de rentabilidad generado', { desde, hasta });

  return {
    resumen: {
      totalIngreso: Math.round(totalIngreso * 100) / 100,
      totalCosto: Math.round(totalCosto * 100) / 100,
      totalUtilidad: Math.round(totalUtilidad * 100) / 100,
      margenGlobal,
      productosConPerdida: productosNegativoS.length,
    },
    porProducto: productosFiltrados,
    porVariante,
    alertas: productosNegativoS.map((p) => ({
      productoId: p.productoId,
      nombre: p.nombre,
      utilidad: p.utilidadBruta,
      mensaje: `"${p.nombre}" está vendiendo por debajo de su costo de producción.`,
    })),
    filtrosAplicados: { desde, hasta, categoriaId, productoId },
    generadoEn: new Date().toISOString(),
  };
};

// ──────────────────────────────────────────────
// REPORTE DE INVENTARIO
// ──────────────────────────────────────────────
export const reporteInventario = async (query) => {
  const { soloAlertas, estado, desde, hasta } = query;

  const where = { estado: estado ?? 'ACTIVO' };

  const [resumen, items, consumo] = await Promise.all([
    reportsRepository.getResumenInventario(),
    reportsRepository.getEstadoInventario(where),
    reportsRepository.getConsumoInsumos(desde, hasta),
  ]);

  // Si soloAlertas=true, retornar solo ítems bajo mínimo o sin stock
  const itemsFiltrados = soloAlertas === 'true'
    ? items.filter((i) => i.alertaStockMinimo || i.stockCritico)
    : items;

  logger.info('Reporte de inventario generado');

  return {
    resumen,
    items: itemsFiltrados,
    consumoInsumos: consumo,
    generadoEn: new Date().toISOString(),
  };
};

// ──────────────────────────────────────────────
// REPORTE DE CAJA Y FLUJO
// ──────────────────────────────────────────────
export const reporteCaja = async (query) => {
  const { desde, hasta, cajaId } = query;

  const whereApertura = {};
  if (cajaId) {
    whereApertura.id = cajaId;
  } else if (desde || hasta) {
    whereApertura.fechaApertura = {};
    if (desde) whereApertura.fechaApertura.gte = new Date(desde);
    if (hasta) whereApertura.fechaApertura.lte = new Date(hasta);
  } else {
    // Por defecto últimos 30 días
    const hace30dias = new Date();
    hace30dias.setDate(hace30dias.getDate() - 30);
    whereApertura.fechaApertura = { gte: hace30dias };
  }

  const [cierres, resumenPeriodo] = await Promise.all([
    reportsRepository.getCierresCaja(whereApertura),
    reportsRepository.getResumenCajas(whereApertura),
  ]);

  // Calcular diferencias acumuladas (sobrantes/faltantes)
  const diferenciaAcumulada = cierres.reduce((acc, c) => acc + (c.diferencia ?? 0), 0);
  const cajasConFaltante = cierres.filter((c) => (c.diferencia ?? 0) < 0).length;
  const cajasConSobrante = cierres.filter((c) => (c.diferencia ?? 0) > 0).length;
  const cajasCuadradas = cierres.filter((c) => (c.diferencia ?? 0) === 0).length;

  logger.info('Reporte de caja generado', { desde, hasta });

  return {
    resumenPeriodo,
    analisisDiferencias: {
      diferenciaAcumulada: Math.round(diferenciaAcumulada * 100) / 100,
      cajasConFaltante,
      cajasConSobrante,
      cajasCuadradas,
    },
    cierres,
    filtrosAplicados: { desde, hasta, cajaId },
    generadoEn: new Date().toISOString(),
  };
};

// ──────────────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────────────
export const dashboard = async (query) => {
  const { desde, hasta } = query;
  const data = await reportsRepository.getDashboardData(desde, hasta);
  logger.info('Dashboard generado');
  return data;
};