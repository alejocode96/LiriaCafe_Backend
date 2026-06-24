// src/modules/sales/sales.repository.js
//
// PATRÓN CRÍTICO — Número de factura consecutivo:
// Usamos MAX(numero) + 1 dentro de la transacción para garantizar
// que no haya números duplicados. En SQLite el single-writer model
// hace esto seguro. En PostgreSQL se usaría una SEQUENCE de BD.
//
// ¿Por qué no usar autoincrement de Prisma?
// Porque necesitamos el número para poder retornarlo en la respuesta
// antes de que el commit de la transacción ocurra, y también porque
// queremos control total sobre el formato del número de factura.

import { prisma } from '../../config/database.js';

// ──────────────────────────────────────────────
// PARA: POST /sales — Crear venta
// ──────────────────────────────────────────────

/**
 * Busca la caja actualmente abierta.
 * Reutilizado del módulo de caja — en lugar de duplicar,
 * hacemos la query directamente aquí para evitar importar
 * el repositorio de otro módulo (evita acoplamiento).
 */
export const findCajaAbierta = async () => {
  return prisma.caja.findFirst({
    where: { estado: 'ABIERTA' },
    select: { id: true, estado: true },
  });
};

/**
 * Busca un producto con sus insumos base e insumos de variante.
 * Retorna todo lo necesario para procesar la venta y descontar inventario.
 */
export const findProductoParaVenta = async (productoId, varianteId = null) => {
  return prisma.producto.findUnique({
    where: { id: productoId },
    include: {
      insumosBase: {
        include: {
          itemInventario: {
            select: {
              id: true,
              nombre: true,
              stockActual: true,
              costoPromedio: true,
              unidadMedida: true,
              estado: true,
            },
          },
        },
      },
      variantes: varianteId ? {
        where: { id: varianteId },
        include: {
          insumosAdicionales: {
            include: {
              itemInventario: {
                select: {
                  id: true,
                  nombre: true,
                  stockActual: true,
                  costoPromedio: true,
                  unidadMedida: true,
                  estado: true,
                },
              },
            },
          },
        },
      } : false,
    },
  });
};

/**
 * La operación más compleja del sistema.
 * Crea la venta, los ítems, descuenta el inventario y registra el Kardex.
 * Todo en una sola transacción atómica.
 */
export const createVenta = async ({
  numero,
  cajaId,
  cajeroId,
  items,
  subtotal,
  descuentoTotal,
  impuestos,
  total,
  metodoPago,
  montoEfectivo,
  montoTransferencia,
  cambio,
  clienteNombre,
  clienteNit,
  insumosADescontar, // Array preparado por el servicio
}) => {
  return prisma.$transaction(async (tx) => {

    // ─────────────────────────────────────────
    // PASO 1: Generar número consecutivo único
    // Se genera DENTRO de la transacción para evitar duplicados
    // ─────────────────────────────────────────
    const maxNumero = await tx.venta.aggregate({
      _max: { numero: true },
    });
    const numeroFinal = numero ?? ((maxNumero._max.numero ?? 0) + 1);

    // ─────────────────────────────────────────
    // PASO 2: Crear la venta principal
    // ─────────────────────────────────────────
    const venta = await tx.venta.create({
      data: {
        numero: numeroFinal,
        cajaId,
        cajeroId,
        subtotal,
        descuentoTotal,
        impuestos,
        total,
        metodoPago,
        montoEfectivo: montoEfectivo ?? null,
        montoTransferencia: montoTransferencia ?? null,
        cambio: cambio ?? null,
        clienteNombre: clienteNombre ?? null,
        clienteNit: clienteNit ?? null,
        estado: 'COMPLETADA',
        fechaVenta: new Date(),
      },
    });

    // ─────────────────────────────────────────
    // PASO 3: Crear los ítems de la venta
    // ─────────────────────────────────────────
    await tx.itemVenta.createMany({
      data: items.map((item) => ({
        ventaId: venta.id,
        productoId: item.productoId,
        varianteId: item.varianteId ?? null,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        descuento: item.descuento,
        subtotal: item.subtotal,
        costoUnitarioSnapshot: item.costoUnitario,
      })),
    });

    // ─────────────────────────────────────────
    // PASO 4: Descontar inventario + Kardex
    // Por cada insumo de cada ítem, decrementar el stock
    // ─────────────────────────────────────────
    for (const insumo of insumosADescontar) {
      // Obtener stock actual antes del descuento
      const itemActual = await tx.itemInventario.findUnique({
        where: { id: insumo.itemInventarioId },
        select: { stockActual: true },
      });

      const stockAntes = itemActual?.stockActual ?? 0;
      const cantidadADescontar = insumo.cantidadTotal;
      const stockDespues = Math.max(0, stockAntes - cantidadADescontar);

      // Actualizar el stock del ítem
      await tx.itemInventario.update({
        where: { id: insumo.itemInventarioId },
        data: { stockActual: stockDespues },
      });

      // Registrar el movimiento en el Kardex
      await tx.movimientoInventario.create({
        data: {
          itemId: insumo.itemInventarioId,
          tipo: 'CONSUMO',
          cantidad: cantidadADescontar,
          stockAntes,
          stockDespues,
          motivo: `Venta #${numeroFinal}`,
          referencia: venta.id,
        },
      });
    }

    // ─────────────────────────────────────────
    // PASO 5: Retornar la venta con todos sus datos
    // ─────────────────────────────────────────
    return tx.venta.findUnique({
      where: { id: venta.id },
      include: {
        items: {
          include: {
            producto: { select: { id: true, nombre: true } },
            variante: { select: { id: true, nombre: true } },
          },
        },
        cajero: {
          select: { id: true, nombreCompleto: true, nombreUsuario: true },
        },
        caja: {
          select: { id: true, fechaApertura: true },
        },
      },
    });
  });
};

// ──────────────────────────────────────────────
// PARA: GET /sales — Listar ventas
// ──────────────────────────────────────────────

export const countVentas = async (where) => {
  return prisma.venta.count({ where });
};

export const findVentas = async ({ where, skip, take }) => {
  return prisma.venta.findMany({
    where,
    skip,
    take,
    select: {
      id: true,
      numero: true,
      total: true,
      subtotal: true,
      descuentoTotal: true,
      metodoPago: true,
      estado: true,
      fechaVenta: true,
      clienteNombre: true,
      cajero: { select: { id: true, nombreCompleto: true, nombreUsuario: true } },
      _count: { select: { items: true } },
    },
    orderBy: { fechaVenta: 'desc' },
  });
};

// ──────────────────────────────────────────────
// PARA: GET /sales/:id — Ver venta completa
// ──────────────────────────────────────────────

export const findVentaById = async (id) => {
  return prisma.venta.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          producto: {
            select: { id: true, nombre: true, precioBase: true },
          },
          variante: {
            select: { id: true, nombre: true, precioDiferencial: true },
          },
        },
      },
      cajero: {
        select: { id: true, nombreCompleto: true, nombreUsuario: true },
      },
      caja: {
        select: { id: true, fechaApertura: true, estado: true },
      },
    },
  });
};

export const findVentaByNumero = async (numero) => {
  return prisma.venta.findUnique({ where: { numero: parseInt(numero, 10) } });
};

// ──────────────────────────────────────────────
// PARA: POST /sales/:id/cancel — Anular venta
// ──────────────────────────────────────────────

/**
 * Anula la venta y revierte el inventario en transacción.
 * El inventario se suma de nuevo (es la operación inversa a la venta).
 */
export const anularVenta = async ({ ventaId, motivoAnulacion, anuladoPorId }) => {
  return prisma.$transaction(async (tx) => {

    // 1. Marcar la venta como ANULADA
    const venta = await tx.venta.update({
      where: { id: ventaId },
      data: {
        estado: 'ANULADA',
        motivoAnulacion,
      },
      include: {
        items: {
          include: {
            producto: {
              include: {
                insumosBase: true,
              },
            },
            variante: {
              include: {
                insumosAdicionales: true,
              },
            },
          },
        },
      },
    });

    // 2. Revertir el inventario — sumar los insumos de vuelta
    for (const item of venta.items) {
      // Recolectar todos los insumos del ítem (base + variante)
      const insumos = [
        ...item.producto.insumosBase.map((i) => ({
          itemInventarioId: i.itemInventarioId,
          cantidad: i.cantidad * item.cantidad,
        })),
        ...(item.variante?.insumosAdicionales ?? []).map((i) => ({
          itemInventarioId: i.itemInventarioId,
          cantidad: i.cantidad * item.cantidad,
        })),
      ];

      for (const insumo of insumos) {
        const itemActual = await tx.itemInventario.findUnique({
          where: { id: insumo.itemInventarioId },
          select: { stockActual: true },
        });

        const stockAntes = itemActual?.stockActual ?? 0;
        const stockDespues = stockAntes + insumo.cantidad;

        // Devolver el stock
        await tx.itemInventario.update({
          where: { id: insumo.itemInventarioId },
          data: { stockActual: stockDespues },
        });

        // Registrar en Kardex como DEVOLUCION
        await tx.movimientoInventario.create({
          data: {
            itemId: insumo.itemInventarioId,
            tipo: 'DEVOLUCION',
            cantidad: insumo.cantidad,
            stockAntes,
            stockDespues,
            motivo: `Anulación venta #${venta.numero}. Motivo: ${motivoAnulacion}`,
            referencia: ventaId,
          },
        });
      }
    }

    return venta;
  });
};