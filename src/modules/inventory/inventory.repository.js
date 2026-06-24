// src/modules/inventory/inventory.repository.js
//
// CONCEPTO CLAVE — COSTO PROMEDIO PONDERADO:
// Cuando entra inventario a diferentes precios, el costo promedio
// se recalcula así:
//
// Ejemplo:
//   Stock actual: 10 kg a $10.000/kg = $100.000 en inventario
//   Nueva entrada: 5 kg a $15.000/kg = $75.000 de compra
//   Nuevo stock: 15 kg
//   Nuevo costo promedio: ($100.000 + $75.000) / 15 kg = $11.666/kg
//
// Esto se llama Costo Promedio Ponderado (CPP).
// Es el método de costeo más justo para un POS pequeño.

import { prisma } from '../../config/database.js';

// ──────────────────────────────────────────────
// PARA: POST /inventory/items
// ──────────────────────────────────────────────

export const findItemByNombre = async (nombre, excluirId = null) => {
  return prisma.itemInventario.findFirst({
    where: {
      nombre: { contains: nombre },
      ...(excluirId && { NOT: { id: excluirId } }),
    },
  });
};

export const createItem = async ({
  nombre,
  unidadMedida,
  stockMinimo,
  proveedorHabitual,
  descripcion,
  creadoPorId,
}) => {
  return prisma.itemInventario.create({
    data: {
      nombre,
      unidadMedida,
      stockMinimo: stockMinimo ?? 0,
      stockActual: 0,        // Siempre empieza en 0
      costoPromedio: 0,      // Se calcula al registrar entradas
      proveedorHabitual,
      descripcion,
      estado: 'ACTIVO',
      creadoPorId,
    },
  });
};

// ──────────────────────────────────────────────
// PARA: GET /inventory/items
// ──────────────────────────────────────────────

export const countItems = async (where) => {
  return prisma.itemInventario.count({ where });
};

export const findItems = async ({ where, skip, take }) => {
  return prisma.itemInventario.findMany({
    where,
    skip,
    take,
    orderBy: { nombre: 'asc' },
  });
};

// ──────────────────────────────────────────────
// PARA: GET /inventory/items/:id
// ──────────────────────────────────────────────

export const findItemById = async (id) => {
  return prisma.itemInventario.findUnique({
    where: { id },
    include: {
      // Últimas 5 entradas para referencia rápida
      entradas: {
        orderBy: { fecha: 'desc' },
        take: 5,
      },
    },
  });
};

// ──────────────────────────────────────────────
// PARA: PUT /inventory/items/:id
// ──────────────────────────────────────────────

export const updateItem = async (id, data) => {
  return prisma.itemInventario.update({
    where: { id },
    data,
  });
};

// ──────────────────────────────────────────────
// PARA: PATCH /inventory/items/:id/deactivate
// ──────────────────────────────────────────────

export const desactivarItem = async (id) => {
  return prisma.itemInventario.update({
    where: { id },
    data: { estado: 'INACTIVO' },
  });
};

// ──────────────────────────────────────────────
// PARA: POST /inventory/items/:id/entries
// ──────────────────────────────────────────────

/**
 * Registra una entrada de inventario y actualiza el stock
 * y el costo promedio ponderado en una transacción atómica.
 *
 * ¿Por qué transacción?
 * Porque son 3 operaciones que deben ocurrir juntas:
 * 1. Crear la entrada
 * 2. Actualizar stockActual del ítem
 * 3. Actualizar costoPromedio del ítem
 * 4. Crear el movimiento en el Kardex
 *
 * Si alguna falla, todas se revierten. El stock nunca queda
 * en un estado inconsistente.
 */
export const createEntrada = async ({
  itemId,
  cantidad,
  precioUnitario,
  proveedor,
  facturaRef,
  notas,
  fecha,
  usuarioId,
  stockActual,
  costoPromedioActual,
}) => {
  return prisma.$transaction(async (tx) => {

    // 1. Calcular el nuevo costo promedio ponderado
    const valorActualEnInventario = stockActual * costoPromedioActual;
    const valorNuevaEntrada = cantidad * precioUnitario;
    const nuevoStock = stockActual + cantidad;
    const nuevoCostoPromedio = nuevoStock > 0
      ? (valorActualEnInventario + valorNuevaEntrada) / nuevoStock
      : precioUnitario;

    // 2. Crear el registro de entrada
    const entrada = await tx.entradaInventario.create({
      data: {
        itemId,
        cantidad,
        precioUnitario,
        precioTotal: cantidad * precioUnitario,
        proveedor,
        facturaRef,
        notas,
        fecha: fecha ? new Date(fecha) : new Date(),
        usuarioId,
      },
    });

    // 3. Actualizar stock y costo promedio del ítem
    const itemActualizado = await tx.itemInventario.update({
      where: { id: itemId },
      data: {
        stockActual: nuevoStock,
        costoPromedio: Math.round(nuevoCostoPromedio * 100) / 100, // 2 decimales
        updatedAt: new Date(),
      },
    });

    // 4. Registrar en el Kardex (historial de movimientos)
    await tx.movimientoInventario.create({
      data: {
        itemId,
        tipo: 'ENTRADA',
        cantidad,
        stockAntes: stockActual,
        stockDespues: nuevoStock,
        motivo: `Entrada de inventario. Ref: ${facturaRef ?? 'N/A'}`,
        referencia: entrada.id,
      },
    });

    return { entrada, itemActualizado };
  });
};

// ──────────────────────────────────────────────
// PARA: GET /inventory/items/:id/kardex
// ──────────────────────────────────────────────

export const findKardex = async ({ itemId, skip, take }) => {
  return prisma.movimientoInventario.findMany({
    where: { itemId },
    skip,
    take,
    orderBy: { createdAt: 'desc' },
  });
};

export const countKardex = async (itemId) => {
  return prisma.movimientoInventario.count({ where: { itemId } });
};

export const activarItem = async (id) => {
  return prisma.itemInventario.update({
    where: { id },
    data: { estado: 'ACTIVO' },
  });
};
