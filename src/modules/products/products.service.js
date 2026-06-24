// src/modules/products/products.service.js
//
// El servicio implementa TODAS las reglas del negocio descritas
// en el documento de requerimientos sección 6.
//
// CONCEPTO CLAVE — Disponibilidad calculada:
// La disponibilidad de un producto depende del stock de sus insumos.
// Cuando el stock de un insumo llega a cero, la variante que lo usa
// se marca automáticamente como no disponible.
// Este cálculo se hace en el servicio, no en la BD, porque requiere
// comparar múltiples registros de tablas diferentes.

import * as productsRepository from './products.repository.js';
import { registrarAuditoria } from '../../middlewares/audit.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors.js';
import { logger } from '../../logger/index.js';
import { prisma } from '../../config/database.js';

// ──────────────────────────────────────────────
// HELPER — Calcular disponibilidad del producto
// ──────────────────────────────────────────────
/**
 * Determina si un producto tiene suficiente stock para venderse.
 * Verifica stock de cada insumo base multiplicado por la cantidad requerida.
 *
 * ¿Por qué está en el servicio y no en el repositorio?
 * Porque es lógica de negocio (regla del POS), no una query simple.
 * El repositorio solo obtiene datos; el servicio los interpreta.
 */
const calcularDisponibilidad = (insumosBase) => {
  if (insumosBase.length === 0) return true; // Sin fórmula = siempre disponible

  return insumosBase.every((insumo) => {
    const { stockActual, estado } = insumo.itemInventario;
    return estado === 'ACTIVO' && stockActual >= insumo.cantidad;
  });
};

// ──────────────────────────────────────────────
// CREAR PRODUCTO
// ──────────────────────────────────────────────
export const crearProducto = async (datos, usuarioId) => {
  const { nombre, categoriaId, insumosBase, ...resto } = datos;

  // REGLA 1: La categoría debe existir y estar activa
  const categoria = await prisma.categoria.findFirst({
    where: { id: categoriaId, estado: 'ACTIVO' },
  });
  if (!categoria) {
    throw new NotFoundError(
      'La categoría especificada no existe o está inactiva. Solo puedes asignar categorías activas.'
    );
  }

  // REGLA 2: El nombre debe ser único dentro de la categoría
  const nombreEnUso = await productsRepository.findProductoByNombreYCategoria(nombre, categoriaId);
  if (nombreEnUso) {
    throw new ConflictError(
      `Ya existe un producto llamado "${nombre}" en la categoría "${categoria.nombre}".`
    );
  }

  // REGLA 3: Verificar que todos los insumos de la fórmula existen y están activos
  if (insumosBase.length > 0) {
    const idsRequeridos = insumosBase.map((i) => i.itemInventarioId);
    const itemsEncontrados = await productsRepository.findItemsInventarioActivos(idsRequeridos);

    if (itemsEncontrados.length !== idsRequeridos.length) {
      // Identificar cuáles no se encontraron para dar un mensaje útil
      const idsEncontrados = itemsEncontrados.map((i) => i.id);
      const idsNoEncontrados = idsRequeridos.filter((id) => !idsEncontrados.includes(id));
      throw new NotFoundError(
        `Los siguientes ítems de inventario no existen o están inactivos: ${idsNoEncontrados.join(', ')}`
      );
    }
  }

  const producto = await productsRepository.createProducto({
    nombre,
    categoriaId,
    insumosBase,
    ...resto,
    creadoPorId: usuarioId,
  });

  await registrarAuditoria({
    accion: 'CREAR_PRODUCTO',
    usuarioId,
    entidad: 'Producto',
    entidadId: producto.id,
    detalle: {
      nombre,
      categoria: categoria.nombre,
      precioBase: datos.precioBase,
      tieneVariantes: datos.tieneVariantes,
      totalInsumos: insumosBase.length,
    },
  });

  logger.info('Producto creado', {
    productoId: producto.id,
    nombre,
    categoriaId,
    usuarioId,
  });

  return producto;
};

// ──────────────────────────────────────────────
// LISTAR PRODUCTOS
// ──────────────────────────────────────────────
export const listarProductos = async (query) => {
  const { page, limit, skip } = parsePagination(query);

  const where = {};

  if (query.estado) where.estado = query.estado;
  if (query.categoriaId) where.categoriaId = query.categoriaId;
  if (query.disponible !== undefined) {
    where.disponible = query.disponible === 'true';
  }
  if (query.buscar) {
    where.nombre = { contains: query.buscar };
  }

  const [total, productos] = await Promise.all([
    productsRepository.countProductos(where),
    productsRepository.findProductos({ where, skip, take: limit }),
  ]);

  return {
    productos,
    meta: buildPaginationMeta(total, page, limit),
  };
};

// ──────────────────────────────────────────────
// VER PRODUCTO POR ID
// ──────────────────────────────────────────────
export const verProducto = async (id) => {
  const producto = await productsRepository.findProductoById(id);

  if (!producto) {
    throw new NotFoundError(`No se encontró el producto con ID: ${id}`);
  }

  // Calcular disponibilidad en tiempo real basada en el stock actual
  const disponibleCalculado = calcularDisponibilidad(producto.insumosBase);

  // Si la disponibilidad calculada difiere de la almacenada, actualizarla
  if (disponibleCalculado !== producto.disponible) {
    await prisma.producto.update({
      where: { id },
      data: { disponible: disponibleCalculado },
    });
    producto.disponible = disponibleCalculado;
  }

  // Calcular costo de producción basado en el costo promedio de los insumos
  const costoProduccion = producto.insumosBase.reduce((total, insumo) => {
    return total + (insumo.cantidad * (insumo.itemInventario.costoPromedio ?? 0));
  }, 0);

  return {
    ...producto,
    costoProduccion: Math.round(costoProduccion * 100) / 100,
    margenBruto: Math.round((producto.precioBase - costoProduccion) * 100) / 100,
    margenPorcentaje: costoProduccion > 0
      ? Math.round(((producto.precioBase - costoProduccion) / producto.precioBase) * 10000) / 100
      : null,
  };
};

// ──────────────────────────────────────────────
// EDITAR PRODUCTO
// ──────────────────────────────────────────────
export const editarProducto = async (id, datos, usuarioId) => {
  const { insumosBase, categoriaId, nombre, ...restoData } = datos;

  const productoActual = await productsRepository.findProductoById(id);
  if (!productoActual) {
    throw new NotFoundError(`No se encontró el producto con ID: ${id}`);
  }

  // Validar nueva categoría si cambia
  if (categoriaId && categoriaId !== productoActual.categoriaId) {
    const categoria = await prisma.categoria.findFirst({
      where: { id: categoriaId, estado: 'ACTIVO' },
    });
    if (!categoria) {
      throw new NotFoundError('La categoría especificada no existe o está inactiva.');
    }
  }

  // Validar unicidad del nombre si cambia
  const catIdFinal = categoriaId ?? productoActual.categoriaId;
  if (nombre && nombre !== productoActual.nombre) {
    const enUso = await productsRepository.findProductoByNombreYCategoria(nombre, catIdFinal, id);
    if (enUso) {
      throw new ConflictError(`Ya existe un producto llamado "${nombre}" en esa categoría.`);
    }
  }

  // Validar insumos si cambian
  if (insumosBase && insumosBase.length > 0) {
    const ids = insumosBase.map((i) => i.itemInventarioId);
    const encontrados = await productsRepository.findItemsInventarioActivos(ids);
    if (encontrados.length !== ids.length) {
      const idsEncontrados = encontrados.map((i) => i.id);
      const faltantes = ids.filter((id) => !idsEncontrados.includes(id));
      throw new NotFoundError(
        `Ítems de inventario no encontrados o inactivos: ${faltantes.join(', ')}`
      );
    }
  }

  const dataActualizar = { ...restoData };
  if (nombre) dataActualizar.nombre = nombre;
  if (categoriaId) dataActualizar.categoriaId = categoriaId;

  const productoActualizado = await productsRepository.updateProducto(
    id,
    dataActualizar,
    insumosBase
  );

  await registrarAuditoria({
    accion: 'EDITAR_PRODUCTO',
    usuarioId,
    entidad: 'Producto',
    entidadId: id,
    detalle: {
      antes: { nombre: productoActual.nombre, precioBase: productoActual.precioBase },
      despues: dataActualizar,
    },
  });

  logger.info('Producto editado', { productoId: id, usuarioId });

  return productoActualizado;
};

// ──────────────────────────────────────────────
// DESACTIVAR PRODUCTO
// ──────────────────────────────────────────────
export const desactivarProducto = async (id, usuarioId) => {
  const producto = await productsRepository.findProductoById(id);
  if (!producto) throw new NotFoundError(`No se encontró el producto con ID: ${id}`);
  if (producto.estado === 'INACTIVO') throw new ConflictError('El producto ya está desactivado.');

  const result = await productsRepository.cambiarEstadoProducto(id, 'INACTIVO');

  await registrarAuditoria({
    accion: 'DESACTIVAR_PRODUCTO',
    usuarioId,
    entidad: 'Producto',
    entidadId: id,
    detalle: { nombre: producto.nombre },
  });

  logger.info('Producto desactivado', { productoId: id, usuarioId });
  return result;
};

// ──────────────────────────────────────────────
// ACTIVAR PRODUCTO
// ──────────────────────────────────────────────
export const activarProducto = async (id, usuarioId) => {
  const producto = await productsRepository.findProductoById(id);
  if (!producto) throw new NotFoundError(`No se encontró el producto con ID: ${id}`);
  if (producto.estado === 'ACTIVO') throw new ConflictError('El producto ya está activo.');

  const result = await productsRepository.cambiarEstadoProducto(id, 'ACTIVO');

  await registrarAuditoria({
    accion: 'ACTIVAR_PRODUCTO',
    usuarioId,
    entidad: 'Producto',
    entidadId: id,
    detalle: { nombre: producto.nombre },
  });

  return result;
};

// ──────────────────────────────────────────────
// CREAR VARIANTE
// ──────────────────────────────────────────────
export const crearVariante = async (productoId, datos, usuarioId) => {
  const { nombre, precioDiferencial, insumosAdicionales } = datos;

  // REGLA 1: El producto debe existir, estar activo y tener variantes habilitadas
  const producto = await productsRepository.findProductoById(productoId);
  if (!producto) throw new NotFoundError(`No se encontró el producto con ID: ${productoId}`);
  if (producto.estado === 'INACTIVO') {
    throw new ConflictError('No se pueden agregar variantes a un producto desactivado.');
  }
  if (!producto.tieneVariantes) {
    throw new ValidationError(
      'Este producto no tiene variantes habilitadas. Activa "tieneVariantes" en el producto primero.',
      []
    );
  }

  // REGLA 2: El nombre de la variante debe ser único dentro del producto
  const varianteExistente = await productsRepository.findVarianteByNombre(nombre, productoId);
  if (varianteExistente) {
    throw new ConflictError(
      `Ya existe una variante llamada "${nombre}" en el producto "${producto.nombre}".`
    );
  }

  // REGLA 3: Verificar insumos adicionales
  if (insumosAdicionales.length > 0) {
    const ids = insumosAdicionales.map((i) => i.itemInventarioId);
    const encontrados = await productsRepository.findItemsInventarioActivos(ids);
    if (encontrados.length !== ids.length) {
      const idsEncontrados = encontrados.map((i) => i.id);
      const faltantes = ids.filter((id) => !idsEncontrados.includes(id));
      throw new NotFoundError(
        `Ítems de inventario no encontrados: ${faltantes.join(', ')}`
      );
    }
  }

  const variante = await productsRepository.createVariante({
    productoId,
    nombre,
    precioDiferencial: precioDiferencial ?? 0,
    insumosAdicionales,
  });

  await registrarAuditoria({
    accion: 'CREAR_VARIANTE',
    usuarioId,
    entidad: 'Variante',
    entidadId: variante.id,
    detalle: {
      productoId,
      productoNombre: producto.nombre,
      varianteNombre: nombre,
      precioDiferencial,
    },
  });

  logger.info('Variante creada', { varianteId: variante.id, productoId, usuarioId });

  return variante;
};

// ──────────────────────────────────────────────
// EDITAR VARIANTE
// ──────────────────────────────────────────────
export const editarVariante = async (productoId, varianteId, datos, usuarioId) => {
  const { nombre, insumosAdicionales, ...restoData } = datos;

  // Verificar que el producto existe
  const producto = await productsRepository.findProductoById(productoId);
  if (!producto) throw new NotFoundError(`Producto no encontrado: ${productoId}`);

  // Verificar que la variante existe y pertenece al producto
  const varianteActual = await productsRepository.findVarianteById(varianteId);
  if (!varianteActual || varianteActual.productoId !== productoId) {
    throw new NotFoundError('Variante no encontrada o no pertenece a este producto.');
  }

  // Verificar unicidad del nombre si cambia
  if (nombre && nombre !== varianteActual.nombre) {
    const enUso = await productsRepository.findVarianteByNombre(nombre, productoId, varianteId);
    if (enUso) {
      throw new ConflictError(`Ya existe una variante llamada "${nombre}" en este producto.`);
    }
  }

  // Verificar insumos adicionales si cambian
  if (insumosAdicionales && insumosAdicionales.length > 0) {
    const ids = insumosAdicionales.map((i) => i.itemInventarioId);
    const encontrados = await productsRepository.findItemsInventarioActivos(ids);
    if (encontrados.length !== ids.length) {
      const idsEncontrados = encontrados.map((i) => i.id);
      const faltantes = ids.filter((id) => !idsEncontrados.includes(id));
      throw new NotFoundError(`Ítems de inventario no encontrados: ${faltantes.join(', ')}`);
    }
  }

  const dataActualizar = { ...restoData };
  if (nombre) dataActualizar.nombre = nombre;

  const varianteActualizada = await productsRepository.updateVariante(
    varianteId,
    dataActualizar,
    insumosAdicionales
  );

  await registrarAuditoria({
    accion: 'EDITAR_VARIANTE',
    usuarioId,
    entidad: 'Variante',
    entidadId: varianteId,
    detalle: { productoId, antes: { nombre: varianteActual.nombre }, despues: dataActualizar },
  });

  return varianteActualizada;
};

// ──────────────────────────────────────────────
// DESACTIVAR VARIANTE
// ──────────────────────────────────────────────
export const desactivarVariante = async (productoId, varianteId, usuarioId) => {
  const variante = await productsRepository.findVarianteById(varianteId);
  if (!variante || variante.productoId !== productoId) {
    throw new NotFoundError('Variante no encontrada o no pertenece a este producto.');
  }
  if (variante.estado === 'INACTIVO') throw new ConflictError('La variante ya está desactivada.');

  const result = await productsRepository.cambiarEstadoVariante(varianteId, 'INACTIVO');

  await registrarAuditoria({
    accion: 'DESACTIVAR_VARIANTE',
    usuarioId,
    entidad: 'Variante',
    entidadId: varianteId,
    detalle: { productoId, nombre: variante.nombre },
  });

  return result;
};

// ──────────────────────────────────────────────
// ACTIVAR VARIANTE
// ──────────────────────────────────────────────
export const activarVariante = async (productoId, varianteId, usuarioId) => {
  const variante = await productsRepository.findVarianteById(varianteId);
  if (!variante || variante.productoId !== productoId) {
    throw new NotFoundError('Variante no encontrada o no pertenece a este producto.');
  }
  if (variante.estado === 'ACTIVO') throw new ConflictError('La variante ya está activa.');

  const result = await productsRepository.cambiarEstadoVariante(varianteId, 'ACTIVO');

  await registrarAuditoria({
    accion: 'ACTIVAR_VARIANTE',
    usuarioId,
    entidad: 'Variante',
    entidadId: varianteId,
    detalle: { productoId, nombre: variante.nombre },
  });

  return result;
};