// src/modules/sales/sales.service.js
//
// Este servicio implementa la lógica de negocio más compleja del sistema.
// El flujo de crearVenta tiene múltiples capas de validación y cálculo
// que deben ejecutarse en orden preciso antes de tocar la BD.
//
// PRINCIPIO: Todo el cálculo de totales, descuentos y validaciones
// ocurre en el servicio. El repositorio solo persiste datos ya calculados.
// Esto hace el código testeable: podemos probar las fórmulas de cálculo
// sin necesidad de una BD.

import * as salesRepository from './sales.repository.js';
import { registrarAuditoria } from '../../middlewares/audit.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors.js';
import { logger } from '../../logger/index.js';

// ──────────────────────────────────────────────
// HELPER — Calcular precio de un ítem con variante
// ──────────────────────────────────────────────
const calcularPrecioItem = (producto, variante) => {
  // Precio base + diferencial de la variante (puede ser negativo)
  return producto.precioBase + (variante?.precioDiferencial ?? 0);
};

// ──────────────────────────────────────────────
// HELPER — Calcular costo de producción del ítem
// ──────────────────────────────────────────────
const calcularCostoItem = (insumosBase, insumosVariante) => {
  const costoBase = insumosBase.reduce((acc, i) => {
    return acc + (i.cantidad * (i.itemInventario.costoPromedio ?? 0));
  }, 0);

  const costoVariante = insumosVariante.reduce((acc, i) => {
    return acc + (i.cantidad * (i.itemInventario.costoPromedio ?? 0));
  }, 0);

  return costoBase + costoVariante;
};

// ──────────────────────────────────────────────
// CREAR VENTA
// ──────────────────────────────────────────────
export const crearVenta = async (datos, cajeroId) => {
  const {
    items: itemsCarrito,
    descuentoTotal,
    metodoPago,
    montoEfectivo,
    montoTransferencia,
    clienteNombre,
    clienteNit,
  } = datos;

  // ═══════════════════════════════════════════
  // BLOQUE 1: VALIDACIONES PREVIAS
  // ═══════════════════════════════════════════

  // REGLA 1: Debe haber una caja abierta
  const cajaActiva = await salesRepository.findCajaAbierta();
  if (!cajaActiva) {
    throw new ValidationError(
      'No hay ninguna caja abierta. Abre una caja antes de registrar ventas.',
      []
    );
  }

  // ═══════════════════════════════════════════
  // BLOQUE 2: VALIDAR Y ENRIQUECER CADA ÍTEM
  // ═══════════════════════════════════════════
  const itemsValidados = [];
  const insumosADescontar = new Map(); // Map para acumular insumos del mismo ítem

  for (const itemCarrito of itemsCarrito) {
    // Buscar el producto con sus insumos y variante si aplica
    const producto = await salesRepository.findProductoParaVenta(
      itemCarrito.productoId,
      itemCarrito.varianteId
    );

    // Validar existencia y estado del producto
    if (!producto) {
      throw new NotFoundError(`Producto no encontrado: ${itemCarrito.productoId}`);
    }
    if (producto.estado !== 'ACTIVO') {
      throw new ValidationError(
        `El producto "${producto.nombre}" está desactivado y no puede venderse.`,
        []
      );
    }
    if (!producto.disponible) {
      throw new ValidationError(
        `El producto "${producto.nombre}" no está disponible actualmente.`,
        []
      );
    }

    // Validar la variante si se especificó
    let varianteSeleccionada = null;
    if (itemCarrito.varianteId) {
      if (!producto.tieneVariantes) {
        throw new ValidationError(
          `El producto "${producto.nombre}" no tiene variantes habilitadas.`,
          []
        );
      }

      varianteSeleccionada = producto.variantes?.[0] ?? null;
      if (!varianteSeleccionada) {
        throw new NotFoundError(
          `Variante ${itemCarrito.varianteId} no encontrada en el producto "${producto.nombre}".`
        );
      }
      if (varianteSeleccionada.estado !== 'ACTIVO') {
        throw new ValidationError(
          `La variante "${varianteSeleccionada.nombre}" está desactivada.`,
          []
        );
      }
    }

    // Si tiene variantes habilitadas pero no se especificó, error
    if (producto.tieneVariantes && !itemCarrito.varianteId) {
      throw new ValidationError(
        `El producto "${producto.nombre}" requiere que selecciones una variante.`,
        [{ campo: 'varianteId', mensaje: 'Este producto requiere una variante.', codigo: 'required' }]
      );
    }

    // Calcular precio y costo del ítem
    const precioUnitario = calcularPrecioItem(producto, varianteSeleccionada);
    const insumosVariante = varianteSeleccionada?.insumosAdicionales ?? [];
    const costoUnitario = calcularCostoItem(producto.insumosBase, insumosVariante);

    // Calcular subtotal del ítem con descuento
    const subtotalItem = (precioUnitario * itemCarrito.cantidad) - (itemCarrito.descuento ?? 0);

    itemsValidados.push({
      productoId: itemCarrito.productoId,
      varianteId: itemCarrito.varianteId ?? null,
      cantidad: itemCarrito.cantidad,
      precioUnitario,
      descuento: itemCarrito.descuento ?? 0,
      subtotal: Math.max(0, subtotalItem), // Nunca negativo
      costoUnitario,
      nombre: producto.nombre,
      nombreVariante: varianteSeleccionada?.nombre ?? null,
    });

    // Acumular insumos para descontar del inventario
    // Combinamos insumos base + insumos de la variante
    const todosLosInsumos = [
      ...producto.insumosBase.map((i) => ({
        itemInventarioId: i.itemInventarioId,
        nombreItem: i.itemInventario.nombre,
        cantidadPorUnidad: i.cantidad,
        stockActual: i.itemInventario.stockActual,
        estadoItem: i.itemInventario.estado,
      })),
      ...insumosVariante.map((i) => ({
        itemInventarioId: i.itemInventarioId,
        nombreItem: i.itemInventario.nombre,
        cantidadPorUnidad: i.cantidad,
        stockActual: i.itemInventario.stockActual,
        estadoItem: i.itemInventario.estado,
      })),
    ];

    for (const insumo of todosLosInsumos) {
      // Verificar que el insumo esté activo
      if (insumo.estadoItem !== 'ACTIVO') {
        throw new ValidationError(
          `El insumo "${insumo.nombreItem}" necesario para "${producto.nombre}" está desactivado.`,
          []
        );
      }

      // Acumular cantidad total a descontar (puede haber múltiples ítems del mismo producto)
      const cantidadTotal = insumo.cantidadPorUnidad * itemCarrito.cantidad;
      const key = insumo.itemInventarioId;

      if (insumosADescontar.has(key)) {
        insumosADescontar.get(key).cantidadTotal += cantidadTotal;
      } else {
        insumosADescontar.set(key, {
          itemInventarioId: key,
          nombreItem: insumo.nombreItem,
          stockActual: insumo.stockActual,
          cantidadTotal,
        });
      }
    }
  }

  // Verificar que hay suficiente stock para todos los insumos
  for (const [, insumo] of insumosADescontar) {
    if (insumo.stockActual < insumo.cantidadTotal) {
      throw new ValidationError(
        `Stock insuficiente de "${insumo.nombreItem}". ` +
        `Disponible: ${insumo.stockActual}. Requerido: ${insumo.cantidadTotal.toFixed(3)}.`,
        []
      );
    }
  }

  // ═══════════════════════════════════════════
  // BLOQUE 3: CALCULAR TOTALES
  // ═══════════════════════════════════════════

  // Subtotal = suma de subtotales de ítems (ya tienen descuento por ítem)
  const subtotal = itemsValidados.reduce((acc, item) => acc + item.subtotal, 0);

  // Por ahora impuestos = 0 (configurable en el futuro con la tabla ConfiguracionNegocio)
  const impuestos = 0;

  // Total final = subtotal - descuento global + impuestos
  const total = Math.max(0, subtotal - (descuentoTotal ?? 0) + impuestos);

  // ═══════════════════════════════════════════
  // BLOQUE 4: VALIDAR MONTOS DE PAGO
  // ═══════════════════════════════════════════

  let cambio = null;

  if (metodoPago === 'EFECTIVO') {
    if (montoEfectivo < total) {
      throw new ValidationError(
        `El monto en efectivo ($${montoEfectivo.toLocaleString()}) es insuficiente. ` +
        `Total de la venta: $${total.toLocaleString()}.`,
        [{ campo: 'montoEfectivo', mensaje: 'Monto insuficiente.', codigo: 'insufficient_amount' }]
      );
    }
    cambio = montoEfectivo - total;
  }

  if (metodoPago === 'TRANSFERENCIA') {
    if (montoTransferencia < total) {
      throw new ValidationError(
        `El monto de transferencia ($${montoTransferencia.toLocaleString()}) es insuficiente.`,
        [{ campo: 'montoTransferencia', mensaje: 'Monto insuficiente.', codigo: 'insufficient_amount' }]
      );
    }
  }

  if (metodoPago === 'COMBINADO') {
    const totalPagado = (montoEfectivo ?? 0) + (montoTransferencia ?? 0);
    if (totalPagado < total) {
      throw new ValidationError(
        `La suma de los pagos ($${totalPagado.toLocaleString()}) no cubre el total ` +
        `de la venta ($${total.toLocaleString()}).`,
        [{ campo: 'metodoPago', mensaje: 'El total pagado no cubre el valor de la venta.', codigo: 'insufficient_amount' }]
      );
    }
    // En pago combinado, el cambio se calcula sobre el efectivo
    if (montoEfectivo > 0) {
      const sobrante = totalPagado - total;
      cambio = sobrante > 0 ? sobrante : 0;
    }
  }

  // ═══════════════════════════════════════════
  // BLOQUE 5: PERSISTIR EN BD (transacción)
  // ═══════════════════════════════════════════

  const venta = await salesRepository.createVenta({
    cajaId: cajaActiva.id,
    cajeroId,
    items: itemsValidados,
    subtotal: Math.round(subtotal * 100) / 100,
    descuentoTotal: descuentoTotal ?? 0,
    impuestos,
    total: Math.round(total * 100) / 100,
    metodoPago,
    montoEfectivo: montoEfectivo ?? null,
    montoTransferencia: montoTransferencia ?? null,
    cambio: cambio !== null ? Math.round(cambio * 100) / 100 : null,
    clienteNombre,
    clienteNit,
    insumosADescontar: Array.from(insumosADescontar.values()),
  });

  await registrarAuditoria({
    accion: 'CREAR_VENTA',
    usuarioId: cajeroId,
    entidad: 'Venta',
    entidadId: venta.id,
    detalle: {
      numero: venta.numero,
      total,
      metodoPago,
      cantidadItems: itemsValidados.length,
      cajaId: cajaActiva.id,
    },
  });

  logger.info('Venta registrada', {
    ventaId: venta.id,
    numero: venta.numero,
    total,
    metodoPago,
    cajeroId,
  });

  return {
    ...venta,
    cambio,
    resumen: {
      subtotal: Math.round(subtotal * 100) / 100,
      descuentoTotal: descuentoTotal ?? 0,
      impuestos,
      total: Math.round(total * 100) / 100,
      cambioADevolver: cambio,
    },
  };
};

// ──────────────────────────────────────────────
// LISTAR VENTAS
// ──────────────────────────────────────────────
export const listarVentas = async (query) => {
  const { page, limit, skip } = parsePagination(query);

  const where = {};

  if (query.estado) where.estado = query.estado;
  if (query.cajaId) where.cajaId = query.cajaId;
  if (query.cajeroId) where.cajeroId = query.cajeroId;
  if (query.metodoPago) where.metodoPago = query.metodoPago;

  if (query.desde || query.hasta) {
    where.fechaVenta = {};
    if (query.desde) where.fechaVenta.gte = new Date(query.desde);
    if (query.hasta) where.fechaVenta.lte = new Date(query.hasta);
  }

  if (query.numero) {
    const numero = parseInt(query.numero, 10);
    if (!isNaN(numero)) where.numero = numero;
  }

  const [total, ventas] = await Promise.all([
    salesRepository.countVentas(where),
    salesRepository.findVentas({ where, skip, take: limit }),
  ]);

  return { ventas, meta: buildPaginationMeta(total, page, limit) };
};

// ──────────────────────────────────────────────
// VER VENTA POR ID
// ──────────────────────────────────────────────
export const verVenta = async (id) => {
  // Permite buscar por ID o por número de factura
  let venta;

  // Si es un número, buscamos por número de factura
  if (/^\d+$/.test(id)) {
    venta = await salesRepository.findVentaByNumero(id);
  }

  // Si no encontramos por número o no es número, buscamos por ID
  if (!venta) {
    venta = await salesRepository.findVentaById(id);
  }

  if (!venta) {
    throw new NotFoundError(`No se encontró la venta con ID o número: ${id}`);
  }

  return venta;
};

// ──────────────────────────────────────────────
// ANULAR VENTA
// ──────────────────────────────────────────────
export const anularVenta = async (id, { motivoAnulacion }, usuarioId) => {

  const venta = await salesRepository.findVentaById(id);

  if (!venta) {
    throw new NotFoundError(`No se encontró la venta con ID: ${id}`);
  }

  // REGLA 1: Solo se pueden anular ventas completadas
  if (venta.estado === 'ANULADA') {
    throw new ConflictError(
      `La venta #${venta.numero} ya está anulada. No se puede anular dos veces.`
    );
  }

  // REGLA 2: No se pueden anular ventas de cajas cerradas
  // (Decisión de diseño: para mantener la integridad del cierre de caja)
  if (venta.caja?.estado === 'CERRADA') {
    throw new ConflictError(
      `La venta #${venta.numero} pertenece a una caja ya cerrada. ` +
      `No se puede anular una venta después del cierre de caja. ` +
      `Registra una nota de ajuste en el próximo turno.`
    );
  }

  const ventaAnulada = await salesRepository.anularVenta({
    ventaId: id,
    motivoAnulacion,
    anuladoPorId: usuarioId,
  });

  await registrarAuditoria({
    accion: 'ANULAR_VENTA',
    usuarioId,
    entidad: 'Venta',
    entidadId: id,
    detalle: {
      numero: venta.numero,
      total: venta.total,
      motivoAnulacion,
    },
  });

  logger.warn('Venta anulada', {
    ventaId: id,
    numero: venta.numero,
    motivoAnulacion,
    usuarioId,
  });

  return ventaAnulada;
};