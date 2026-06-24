// src/modules/inventory/inventory.service.js
import * as inventoryRepository from './inventory.repository.js';
import { registrarAuditoria } from '../../middlewares/audit.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import { logger } from '../../logger/index.js';

// ──────────────────────────────────────────────
// CREAR ÍTEM DE INVENTARIO
// ──────────────────────────────────────────────
export const crearItem = async (datos, usuarioId) => {
  const { nombre, unidadMedida, stockMinimo, proveedorHabitual, descripcion } = datos;

  // Verificar unicidad del nombre
  const existente = await inventoryRepository.findItemByNombre(nombre);
  if (existente) {
    throw new ConflictError(
      `Ya existe un ítem de inventario con el nombre "${nombre}".`
    );
  }

  const item = await inventoryRepository.createItem({
    nombre,
    unidadMedida: unidadMedida.toLowerCase(),
    stockMinimo,
    proveedorHabitual,
    descripcion,
    creadoPorId: usuarioId,
  });

  await registrarAuditoria({
    accion: 'CREAR_ITEM_INVENTARIO',
    usuarioId,
    entidad: 'ItemInventario',
    entidadId: item.id,
    detalle: { nombre, unidadMedida, stockMinimo },
  });

  logger.info('Ítem de inventario creado', { itemId: item.id, nombre, usuarioId });

  return item;
};

// ──────────────────────────────────────────────
// LISTAR ÍTEMS
// ──────────────────────────────────────────────

export const listarItems = async (query) => {
  const { page, limit, skip } = parsePagination(query);

  const where = {};

  if (query.estado) {
    where.estado = query.estado;
  }

  if (query.buscar) {
    where.nombre = { contains: query.buscar };
  }

  // Cuando bajoStock=true traemos TODOS los activos y filtramos en memoria
  // porque SQLite no soporta comparar dos campos de la misma fila en Prisma
  // En PostgreSQL se podría usar whereRaw para mayor eficiencia
  const whereConsulta = query.bajoStock === 'true'
    ? { ...where, estado: 'ACTIVO' }  // Solo activos para bajo stock
    : where;

  const [total, items] = await Promise.all([
    inventoryRepository.countItems(whereConsulta),
    inventoryRepository.findItems({ where: whereConsulta, skip, take: limit }),
  ]);

  // Filtro de bajo stock en memoria — compatible con SQLite y PostgreSQL
  const itemsFiltrados = query.bajoStock === 'true'
    ? items.filter((item) => item.stockActual <= item.stockMinimo)
    : items;

  return {
    items: itemsFiltrados,
    meta: buildPaginationMeta(total, page, limit),
  };
};
// ──────────────────────────────────────────────
// VER ÍTEM POR ID
// ──────────────────────────────────────────────
export const verItem = async (id) => {
  const item = await inventoryRepository.findItemById(id);

  if (!item) {
    throw new NotFoundError(`No se encontró el ítem de inventario con ID: ${id}`);
  }

  // Calcular si está bajo el stock mínimo
  const bajoBajo = item.stockActual <= item.stockMinimo;

  return {
    ...item,
    alertaStockMinimo: bajoBajo,
    // Valor total del inventario de este ítem
    valorInventario: Math.round(item.stockActual * item.costoPromedio * 100) / 100,
  };
};

// ──────────────────────────────────────────────
// EDITAR ÍTEM
// ──────────────────────────────────────────────
export const editarItem = async (id, datos, usuarioId) => {
  const itemActual = await inventoryRepository.findItemById(id);
  if (!itemActual) {
    throw new NotFoundError(`No se encontró el ítem con ID: ${id}`);
  }

  if (datos.nombre && datos.nombre !== itemActual.nombre) {
    const enUso = await inventoryRepository.findItemByNombre(datos.nombre, id);
    if (enUso) {
      throw new ConflictError(`Ya existe un ítem con el nombre "${datos.nombre}".`);
    }
  }

  const itemActualizado = await inventoryRepository.updateItem(id, datos);

  await registrarAuditoria({
    accion: 'EDITAR_ITEM_INVENTARIO',
    usuarioId,
    entidad: 'ItemInventario',
    entidadId: id,
    detalle: { antes: { nombre: itemActual.nombre }, despues: datos },
  });

  logger.info('Ítem editado', { itemId: id, usuarioId });

  return itemActualizado;
};

// ──────────────────────────────────────────────
// DESACTIVAR ÍTEM
// ──────────────────────────────────────────────
export const desactivarItem = async (id, usuarioId) => {
  const item = await inventoryRepository.findItemById(id);
  if (!item) {
    throw new NotFoundError(`No se encontró el ítem con ID: ${id}`);
  }

  if (item.estado === 'INACTIVO') {
    throw new ConflictError('El ítem ya está desactivado.');
  }

  const itemDesactivado = await inventoryRepository.desactivarItem(id);

  await registrarAuditoria({
    accion: 'DESACTIVAR_ITEM_INVENTARIO',
    usuarioId,
    entidad: 'ItemInventario',
    entidadId: id,
    detalle: { nombre: item.nombre, stockActual: item.stockActual },
  });

  return itemDesactivado;
};

// ──────────────────────────────────────────────
// REGISTRAR ENTRADA DE INVENTARIO
// ──────────────────────────────────────────────
export const registrarEntrada = async (itemId, datos, usuarioId) => {
  // Verificar que el ítem existe y está activo
  const item = await inventoryRepository.findItemById(itemId);
  if (!item) {
    throw new NotFoundError(`No se encontró el ítem con ID: ${itemId}`);
  }

  if (item.estado === 'INACTIVO') {
    throw new ConflictError(
      'No se puede registrar entrada en un ítem desactivado. Reactívalo primero.'
    );
  }

  const { entrada, itemActualizado } = await inventoryRepository.createEntrada({
    itemId,
    ...datos,
    usuarioId,
    stockActual: item.stockActual,
    costoPromedioActual: item.costoPromedio,
  });

  await registrarAuditoria({
    accion: 'ENTRADA_INVENTARIO',
    usuarioId,
    entidad: 'ItemInventario',
    entidadId: itemId,
    detalle: {
      cantidad: datos.cantidad,
      precioUnitario: datos.precioUnitario,
      precioTotal: datos.cantidad * datos.precioUnitario,
      stockAntes: item.stockActual,
      stockDespues: itemActualizado.stockActual,
      nuevoCostoPromedio: itemActualizado.costoPromedio,
    },
  });

  logger.info('Entrada de inventario registrada', {
    itemId,
    cantidad: datos.cantidad,
    precioUnitario: datos.precioUnitario,
    usuarioId,
  });

  return {
    entrada,
    item: {
      id: itemActualizado.id,
      nombre: itemActualizado.nombre,
      stockAnterior: item.stockActual,
      stockActual: itemActualizado.stockActual,
      costoPromedioAnterior: item.costoPromedio,
      costoPromedioActual: itemActualizado.costoPromedio,
    },
  };
};

// ──────────────────────────────────────────────
// VER KARDEX DEL ÍTEM
// ──────────────────────────────────────────────
export const verKardex = async (itemId, query) => {
  const item = await inventoryRepository.findItemById(itemId);
  if (!item) {
    throw new NotFoundError(`No se encontró el ítem con ID: ${itemId}`);
  }

  const { page, limit, skip } = parsePagination(query);

  const [total, movimientos] = await Promise.all([
    inventoryRepository.countKardex(itemId),
    inventoryRepository.findKardex({ itemId, skip, take: limit }),
  ]);

  return {
    item: {
      id: item.id,
      nombre: item.nombre,
      unidadMedida: item.unidadMedida,
      stockActual: item.stockActual,
      costoPromedio: item.costoPromedio,
    },
    movimientos,
    meta: buildPaginationMeta(total, page, limit),
  };
};

export const activarItem = async (id, usuarioId) => {
  const item = await inventoryRepository.findItemById(id);

  if (!item) {
    throw new NotFoundError(`No se encontró el ítem con ID: ${id}`);
  }

  if (item.estado === 'ACTIVO') {
    throw new ConflictError('El ítem ya está activo.');
  }

  const itemActivado = await inventoryRepository.activarItem(id);

  await registrarAuditoria({
    accion: 'ACTIVAR_ITEM_INVENTARIO',
    usuarioId,
    entidad: 'ItemInventario',
    entidadId: id,
    detalle: { nombre: item.nombre },
  });

  logger.info('Ítem activado', { itemId: id, usuarioId });

  return itemActivado;
};