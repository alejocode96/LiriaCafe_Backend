// src/modules/cash-flow/cash-flow.service.js
//
// El servicio de flujo de caja tiene una complejidad especial:
// el tipo COMPRA_INVENTARIO crea dos registros en paralelo:
// 1. El movimiento de flujo de caja (dinero que salió)
// 2. La entrada de inventario (insumo que entró)
//
// Esta dualidad es lo que el documento llama "trazabilidad directa"
// entre el gasto de caja y el inventario recibido.
// El repositorio maneja la transacción atómica para garantizar
// que ambos registros se crean o ninguno se crea.

import * as cashFlowRepository from './cash-flow.repository.js';
import { registrarAuditoria } from '../../middlewares/audit.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { logger } from '../../logger/index.js';
import { prisma } from '../../config/database.js';

// ──────────────────────────────────────────────
// CATEGORÍAS
// ──────────────────────────────────────────────

export const crearCategoriaMov = async ({ nombre, descripcion }, usuarioId) => {
  const existente = await cashFlowRepository.findCategoriaMoyByNombre(nombre);
  if (existente) {
    throw new ConflictError(`Ya existe una categoría con el nombre "${nombre}".`);
  }

  const categoria = await cashFlowRepository.createCategoriaMov({ nombre, descripcion });

  await registrarAuditoria({
    accion: 'CREAR_CATEGORIA_MOVIMIENTO',
    usuarioId,
    entidad: 'CategoriaMovimiento',
    entidadId: categoria.id,
    detalle: { nombre },
  });

  logger.info('Categoría de movimiento creada', { categoriaId: categoria.id, nombre });
  return categoria;
};

export const listarCategoriasMov = async (query) => {
  const { page, limit, skip } = parsePagination(query);
  const where = {};
  if (query.estado) where.estado = query.estado;

  const [total, categorias] = await Promise.all([
    cashFlowRepository.countCategoriasMov(where),
    cashFlowRepository.findCategoriasMov({ where, skip, take: limit }),
  ]);

  return { categorias, meta: buildPaginationMeta(total, page, limit) };
};

export const desactivarCategoriaMov = async (id, usuarioId) => {
  const categoria = await cashFlowRepository.findCategoriaMovById(id);
  if (!categoria) throw new NotFoundError(`Categoría no encontrada: ${id}`);
  if (categoria.estado === 'INACTIVO') throw new ConflictError('La categoría ya está desactivada.');

  const result = await cashFlowRepository.cambiarEstadoCategoriaMov(id, 'INACTIVO');

  await registrarAuditoria({
    accion: 'DESACTIVAR_CATEGORIA_MOVIMIENTO',
    usuarioId,
    entidad: 'CategoriaMovimiento',
    entidadId: id,
    detalle: { nombre: categoria.nombre, movimientosAsociados: categoria._count.movimientos },
  });

  return result;
};

export const activarCategoriaMov = async (id, usuarioId) => {
  const categoria = await cashFlowRepository.findCategoriaMovById(id);
  if (!categoria) throw new NotFoundError(`Categoría no encontrada: ${id}`);
  if (categoria.estado === 'ACTIVO') throw new ConflictError('La categoría ya está activa.');

  const result = await cashFlowRepository.cambiarEstadoCategoriaMov(id, 'ACTIVO');

  await registrarAuditoria({
    accion: 'ACTIVAR_CATEGORIA_MOVIMIENTO',
    usuarioId,
    entidad: 'CategoriaMovimiento',
    entidadId: id,
    detalle: { nombre: categoria.nombre },
  });

  return result;
};

// ──────────────────────────────────────────────
// MOVIMIENTOS
// ──────────────────────────────────────────────

export const registrarMovimiento = async (datos, usuarioId) => {
  const {
    tipo,
    monto,
    concepto,
    categoriaId,
    medioPago,
    afectaCaja,
    notas,
    itemInventarioId,
    cantidadInventario,
  } = datos;

  // REGLA 1: Debe haber una caja abierta para registrar movimientos
  // que afecten la caja
  const cajaActiva = await cashFlowRepository.findCajaAbierta();

  if (afectaCaja && !cajaActiva) {
    throw new ValidationError(
      'No hay ninguna caja abierta. No puedes registrar un movimiento que afecte la caja sin una caja activa.',
      [{ campo: 'afectaCaja', mensaje: 'Se requiere caja abierta.', codigo: 'no_caja_abierta' }]
    );
  }

  // REGLA 2: Verificar que la categoría existe si se especificó
  if (categoriaId) {
    const categoria = await cashFlowRepository.findCategoriaMovById(categoriaId);
    if (!categoria) {
      throw new NotFoundError(`Categoría de movimiento no encontrada: ${categoriaId}`);
    }
    if (categoria.estado === 'INACTIVO') {
      throw new ConflictError(
        `La categoría "${categoria.nombre}" está inactiva. Selecciona una categoría activa.`
      );
    }
  }

  // REGLA 3: Para COMPRA_INVENTARIO, verificar el ítem de inventario
  let itemInventario = null;
  if (tipo === 'COMPRA_INVENTARIO') {
    itemInventario = await prisma.itemInventario.findUnique({
      where: { id: itemInventarioId },
      select: { id: true, nombre: true, stockActual: true, costoPromedio: true, estado: true },
    });

    if (!itemInventario) {
      throw new NotFoundError(`Ítem de inventario no encontrado: ${itemInventarioId}`);
    }
    if (itemInventario.estado === 'INACTIVO') {
      throw new ConflictError(
        `El ítem "${itemInventario.nombre}" está desactivado. Reactívalo primero.`
      );
    }
  }

  // Usar la caja activa si afectaCaja, o null si no afecta
  const cajaId = afectaCaja && cajaActiva ? cajaActiva.id : null;

  // Si no afecta caja pero hay caja activa, igual la vinculamos para trazabilidad
  // pero el campo afectaCaja = false le dice al cierre que no la incluya
  const cajaIdParaRegistro = cajaActiva?.id ?? null;

  const movimiento = await cashFlowRepository.createMovimiento({
    tipo,
    monto,
    concepto,
    categoriaId,
    medioPago,
    afectaCaja: afectaCaja ?? true,
    notas,
    cajaId: cajaIdParaRegistro,
    usuarioId,
    // Para COMPRA_INVENTARIO
    itemInventarioId: itemInventarioId ?? null,
    cantidadInventario: cantidadInventario ?? null,
    costoPromedioActual: itemInventario?.costoPromedio ?? 0,
    stockActualItem: itemInventario?.stockActual ?? 0,
  });

  await registrarAuditoria({
    accion: `MOVIMIENTO_${tipo}`,
    usuarioId,
    entidad: 'MovimientoCaja',
    entidadId: movimiento.id,
    detalle: {
      tipo,
      monto,
      concepto,
      medioPago,
      afectaCaja,
      cajaId: cajaIdParaRegistro,
      ...(tipo === 'COMPRA_INVENTARIO' && {
        itemInventario: itemInventario?.nombre,
        cantidadInventario,
      }),
    },
  });

  logger.info('Movimiento de flujo de caja registrado', {
    movimientoId: movimiento.id,
    tipo,
    monto,
    medioPago,
    usuarioId,
  });

  return movimiento;
};

export const listarMovimientos = async (query) => {
  const { page, limit, skip } = parsePagination(query);

  const where = {};
  if (query.tipo) where.tipo = query.tipo;
  if (query.medioPago) where.medioPago = query.medioPago;
  if (query.categoriaId) where.categoriaId = query.categoriaId;
  if (query.cajaId) where.cajaId = query.cajaId;
  if (query.afectaCaja !== undefined) {
    where.afectaCaja = query.afectaCaja === 'true';
  }
  if (query.desde || query.hasta) {
    where.createdAt = {};
    if (query.desde) where.createdAt.gte = new Date(query.desde);
    if (query.hasta) where.createdAt.lte = new Date(query.hasta);
  }

  const [total, movimientos] = await Promise.all([
    cashFlowRepository.countMovimientos(where),
    cashFlowRepository.findMovimientos({ where, skip, take: limit }),
  ]);

  return { movimientos, meta: buildPaginationMeta(total, page, limit) };
};

export const verMovimiento = async (id) => {
  const movimiento = await cashFlowRepository.findMovimientoById(id);
  if (!movimiento) throw new NotFoundError(`Movimiento no encontrado: ${id}`);
  return movimiento;
};

// ──────────────────────────────────────────────
// RESUMEN FINANCIERO
// ──────────────────────────────────────────────

export const resumenFinanciero = async (query) => {
  const where = {};

  if (query.cajaId) {
    where.cajaId = query.cajaId;
  }

  if (query.desde || query.hasta) {
    where.createdAt = {};
    if (query.desde) where.createdAt.gte = new Date(query.desde);
    if (query.hasta) where.createdAt.lte = new Date(query.hasta);
  }

  // Si no se especifica ningún filtro, usar la caja activa del día
  if (!query.cajaId && !query.desde && !query.hasta) {
    const cajaActiva = await cashFlowRepository.findCajaAbierta();
    if (cajaActiva) {
      where.cajaId = cajaActiva.id;
    }
  }

  const resumen = await cashFlowRepository.calcularResumenFinanciero(where);

  // Enriquecer el resumen con nombres de categorías
  const categoriaIds = resumen.porCategoria
    .filter((c) => c.categoriaId)
    .map((c) => c.categoriaId);

  let categoriasNombres = {};
  if (categoriaIds.length > 0) {
    const categorias = await prisma.categoriaMovimiento.findMany({
      where: { id: { in: categoriaIds } },
      select: { id: true, nombre: true },
    });
    categoriasNombres = Object.fromEntries(categorias.map((c) => [c.id, c.nombre]));
  }

  const porCategoriaEnriquecida = resumen.porCategoria.map((c) => ({
    categoriaId: c.categoriaId,
    categoriaNombre: c.categoriaId ? (categoriasNombres[c.categoriaId] ?? 'Sin categoría') : 'Sin categoría',
    tipo: c.tipo,
    total: c._sum.monto ?? 0,
    cantidad: c._count.id ?? 0,
  }));

  return {
    ...resumen,
    porCategoria: porCategoriaEnriquecida,
    filtrosAplicados: {
      cajaId: where.cajaId ?? null,
      desde: query.desde ?? null,
      hasta: query.hasta ?? null,
    },
  };
};