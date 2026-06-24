// src/modules/categories/categories.service.js
//
// El servicio es el CEREBRO del módulo.
// Aquí viven las reglas de negocio, NO en el controlador ni en el repositorio.
//
// Principio de Responsabilidad Única (S de SOLID):
// - El repositorio solo consulta datos.
// - El controlador solo maneja HTTP.
// - El servicio solo aplica reglas de negocio.

import * as categoriesRepository from './categories.repository.js';
import { registrarAuditoria } from '../../middlewares/audit.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import { logger } from '../../logger/index.js';

// ──────────────────────────────────────────────
// CREAR CATEGORÍA
// ──────────────────────────────────────────────
export const crearCategoria = async (
  { nombre, descripcion, imagenUrl, orden },
  usuarioId
) => {
  // REGLA 1: El nombre debe ser único (case-insensitive)
  // "Bebidas" y "bebidas" son la misma categoría
  const existente = await categoriesRepository.findCategoriaByNombre(nombre);
  if (existente) {
    throw new ConflictError(
      `Ya existe una categoría con el nombre "${nombre}".`
    );
  }

  // REGLA 2: Si no se envía orden, calcular el siguiente disponible
  // Así el admin no tiene que preocuparse por números de orden
  const ordenFinal = orden !== undefined
    ? orden
    : await categoriesRepository.getMaxOrden();

  const categoria = await categoriesRepository.createCategoria({
    nombre,
    descripcion,
    imagenUrl,
    orden: ordenFinal,
    creadoPorId: usuarioId,
  });

  await registrarAuditoria({
    accion: 'CREAR_CATEGORIA',
    usuarioId,
    entidad: 'Categoria',
    entidadId: categoria.id,
    detalle: { nombre, orden: ordenFinal },
  });

  logger.info('Categoría creada', { categoriaId: categoria.id, nombre, usuarioId });

  return categoria;
};

// ──────────────────────────────────────────────
// LISTAR CATEGORÍAS
// ──────────────────────────────────────────────
export const listarCategorias = async (query) => {
  const { page, limit, skip } = parsePagination(query);

  const where = {};

  if (query.estado) {
    where.estado = query.estado;
  }

  if (query.buscar) {
    where.nombre = { contains: query.buscar };
  }

  const [total, categorias] = await Promise.all([
    categoriesRepository.countCategorias(where),
    categoriesRepository.findCategorias({ where, skip, take: limit }),
  ]);

  return {
    categorias,
    meta: buildPaginationMeta(total, page, limit),
  };
};

// ──────────────────────────────────────────────
// VER CATEGORÍA POR ID
// ──────────────────────────────────────────────
export const verCategoria = async (id) => {
  const categoria = await categoriesRepository.findCategoriaById(id);

  if (!categoria) {
    throw new NotFoundError(`No se encontró la categoría con ID: ${id}`);
  }

  return categoria;
};

// ──────────────────────────────────────────────
// EDITAR CATEGORÍA
// ──────────────────────────────────────────────
export const editarCategoria = async (id, datos, usuarioId) => {
  const categoriaActual = await categoriesRepository.findCategoriaById(id);
  if (!categoriaActual) {
    throw new NotFoundError(`No se encontró la categoría con ID: ${id}`);
  }

  // Verificar unicidad de nombre solo si cambia
  if (datos.nombre && datos.nombre !== categoriaActual.nombre) {
    const enUso = await categoriesRepository.findCategoriaByNombre(datos.nombre, id);
    if (enUso) {
      throw new ConflictError(
        `Ya existe una categoría con el nombre "${datos.nombre}".`
      );
    }
  }

  const categoriaActualizada = await categoriesRepository.updateCategoria(id, datos);

  await registrarAuditoria({
    accion: 'EDITAR_CATEGORIA',
    usuarioId,
    entidad: 'Categoria',
    entidadId: id,
    detalle: {
      antes: { nombre: categoriaActual.nombre, orden: categoriaActual.orden },
      despues: datos,
    },
  });

  logger.info('Categoría editada', { categoriaId: id, usuarioId });

  return categoriaActualizada;
};

// ──────────────────────────────────────────────
// DESACTIVAR CATEGORÍA
// ──────────────────────────────────────────────
export const desactivarCategoria = async (id, usuarioId) => {
  const categoria = await categoriesRepository.findCategoriaById(id);
  if (!categoria) {
    throw new NotFoundError(`No se encontró la categoría con ID: ${id}`);
  }

  if (categoria.estado === 'INACTIVO') {
    throw new ConflictError('La categoría ya está desactivada.');
  }

  // REGLA: Al desactivar, los productos asociados quedan "sin categoría activa"
  // No los eliminamos — el documento dice conservar todo.
  // El frontend debe manejar este caso mostrando una advertencia.
  const productosAsociados = categoria._count?.productos ?? 0;

  const categoriaDesactivada = await categoriesRepository.desactivarCategoria(id);

  await registrarAuditoria({
    accion: 'DESACTIVAR_CATEGORIA',
    usuarioId,
    entidad: 'Categoria',
    entidadId: id,
    detalle: {
      nombre: categoria.nombre,
      productosAfectados: productosAsociados,
    },
  });

  logger.info('Categoría desactivada', {
    categoriaId: id,
    productosAfectados: productosAsociados,
    usuarioId,
  });

  return {
    ...categoriaDesactivada,
    advertencia: productosAsociados > 0
      ? `${productosAsociados} producto(s) quedaron sin categoría activa. Reasígnalos.`
      : null,
  };
};

// AGREGAR al final de categories.service.js
export const activarCategoria = async (id, usuarioId) => {
  const categoria = await categoriesRepository.findCategoriaById(id);

  if (!categoria) {
    throw new NotFoundError(`No se encontró la categoría con ID: ${id}`);
  }

  if (categoria.estado === 'ACTIVO') {
    throw new ConflictError('La categoría ya está activa.');
  }

  const categoriaActivada = await categoriesRepository.activarCategoria(id);

  await registrarAuditoria({
    accion: 'ACTIVAR_CATEGORIA',
    usuarioId,
    entidad: 'Categoria',
    entidadId: id,
    detalle: { nombre: categoria.nombre },
  });

  logger.info('Categoría activada', { categoriaId: id, usuarioId });

  return categoriaActivada;
};