// src/modules/categories/categories.repository.js
//
// ¿Por qué separar el repositorio del servicio?
// Si en el futuro cambiamos de SQLite a PostgreSQL, o de Prisma
// a otro ORM, solo modificamos este archivo. El servicio y el
// controlador no cambian. Esto es el principio de inversión de
// dependencias (la 'D' de SOLID).

import { prisma } from '../../config/database.js';

// ──────────────────────────────────────────────
// PARA: POST /categories
// ──────────────────────────────────────────────

/**
 * Verifica si ya existe una categoría con ese nombre.
 * El parámetro excluirId permite reutilizar en edición.
 */
export const findCategoriaByNombre = async (nombre, excluirId = null) => {
  return prisma.categoria.findFirst({
    where: {
      nombre: nombre.trim().toLowerCase(),
      // mode: 'insensitive' = búsqueda case-insensitive
      // "bebidas frías" = "Bebidas Frías" = "BEBIDAS FRÍAS"
      // NOTA: SQLite no soporta mode insensitive nativamente en Prisma.
      // En SQLite usamos contains sin mode. En PostgreSQL sí funciona.
      ...(excluirId && { NOT: { id: excluirId } }),
    },
  });
};

/**
 * Calcula el siguiente número de orden disponible.
 * Evita duplicidad de orden y simplifica la UI.
 */
export const getMaxOrden = async () => {
  const resultado = await prisma.categoria.aggregate({
    _max: { orden: true },
    where: { estado: 'ACTIVO' },
  });
  return (resultado._max.orden ?? -1) + 1;
  // Si no hay categorías, retorna 0. Si el máximo es 3, retorna 4.
};

/**
 * Crea la categoría en la BD.
 */
export const createCategoria = async ({
  nombre,
  descripcion,
  imagenUrl,
  orden,
  creadoPorId,
}) => {
  return prisma.categoria.create({
    data: {
      nombre,
      descripcion,
      imagenUrl,
      orden,
      estado: 'ACTIVO',
      creadoPorId,
    },
  });
};

// ──────────────────────────────────────────────
// PARA: GET /categories
// ──────────────────────────────────────────────

export const countCategorias = async (where) => {
  return prisma.categoria.count({ where });
};

export const findCategorias = async ({ where, skip, take }) => {
  return prisma.categoria.findMany({
    where,
    skip,
    take,
    include: {
      // Contamos los productos asociados sin traerlos todos
      _count: { select: { productos: true } },
    },
    orderBy: [
      { orden: 'asc' },      // Primero por orden manual
      { createdAt: 'desc' }, // Luego por fecha de creación
    ],
  });
};

// ──────────────────────────────────────────────
// PARA: GET /categories/:id
// ──────────────────────────────────────────────

export const findCategoriaById = async (id) => {
  return prisma.categoria.findUnique({
    where: { id },
    include: {
      _count: { select: { productos: true } },
    },
  });
};

// ──────────────────────────────────────────────
// PARA: PUT /categories/:id
// ──────────────────────────────────────────────

export const updateCategoria = async (id, data) => {
  return prisma.categoria.update({
    where: { id },
    data,
    include: {
      _count: { select: { productos: true } },
    },
  });
};

// ──────────────────────────────────────────────
// PARA: PATCH /categories/:id/deactivate
// ──────────────────────────────────────────────

export const desactivarCategoria = async (id) => {
  return prisma.categoria.update({
    where: { id },
    data: { estado: 'INACTIVO' },
  });
};

export const activarCategoria = async (id) => {
  return prisma.categoria.update({
    where: { id },
    data: { estado: 'ACTIVO' },
    include: {
      _count: { select: { productos: true } },
    },
  });
};