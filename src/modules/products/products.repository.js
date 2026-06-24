// src/modules/products/products.repository.js
//
// PATRÓN IMPORTANTE — Transacciones anidadas:
// Al crear un producto con fórmula de insumos, son 2+ operaciones.
// Usamos prisma.$transaction() para garantizar que si la creación
// de un insumo falla, el producto también se revierte. La BD
// nunca queda en un estado inconsistente.
//
// RENDIMIENTO: La query de findProductoById incluye todas las relaciones
// porque el detalle de un producto necesita mostrar categoría, insumos
// y variantes. Para el listado usamos una query más liviana.

import { prisma } from '../../config/database.js';

// ──────────────────────────────────────────────
// PARA: POST /products — Crear producto
// ──────────────────────────────────────────────

/**
 * Verifica si ya existe un producto con ese nombre en esa categoría.
 * Dos categorías diferentes pueden tener un producto con el mismo nombre.
 * Ejemplo: "Especial" en Bebidas Frías y "Especial" en Postres son válidos.
 */
export const findProductoByNombreYCategoria = async (nombre, categoriaId, excluirId = null) => {
  return prisma.producto.findFirst({
    where: {
      nombre: { contains: nombre },
      categoriaId,
      ...(excluirId && { NOT: { id: excluirId } }),
    },
  });
};

/**
 * Verifica que una lista de IDs de ítems de inventario existen y están activos.
 * Retorna un array con los ítems encontrados para comparar contra los solicitados.
 */
export const findItemsInventarioActivos = async (ids) => {
  return prisma.itemInventario.findMany({
    where: {
      id: { in: ids },
      estado: 'ACTIVO',
    },
    select: { id: true, nombre: true, unidadMedida: true },
  });
};

/**
 * Crea el producto y su fórmula de insumos base en una transacción atómica.
 */
export const createProducto = async ({
  nombre,
  descripcion,
  categoriaId,
  precioBase,
  imagenUrl,
  tieneVariantes,
  insumosBase,
  creadoPorId,
}) => {
  return prisma.$transaction(async (tx) => {
    // 1. Crear el producto
    const producto = await tx.producto.create({
      data: {
        nombre,
        descripcion,
        categoriaId,
        precioBase,
        imagenUrl,
        tieneVariantes,
        disponible: true,
        estado: 'ACTIVO',
        creadoPorId,
      },
    });

    // 2. Crear los insumos base de la fórmula
    // createMany es más eficiente que múltiples create()
    // Inserta todas las filas en una sola query SQL
    if (insumosBase.length > 0) {
      await tx.insumoProducto.createMany({
        data: insumosBase.map((insumo) => ({
          productoId: producto.id,
          itemInventarioId: insumo.itemInventarioId,
          cantidad: insumo.cantidad,
        })),
      });
    }

    // 3. Retornar el producto con todas sus relaciones
    return tx.producto.findUnique({
      where: { id: producto.id },
      include: {
        categoria: { select: { id: true, nombre: true } },
        insumosBase: {
          include: {
            itemInventario: {
              select: { id: true, nombre: true, unidadMedida: true },
            },
          },
        },
        variantes: true,
      },
    });
  });
};

// ──────────────────────────────────────────────
// PARA: GET /products — Listar productos
// ──────────────────────────────────────────────

export const countProductos = async (where) => {
  return prisma.producto.count({ where });
};

/**
 * Query liviana para listado — no incluye fórmulas completas
 * para no sobrecargar la respuesta con datos innecesarios.
 */
export const findProductos = async ({ where, skip, take }) => {
  return prisma.producto.findMany({
    where,
    skip,
    take,
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      precioBase: true,
      imagenUrl: true,
      tieneVariantes: true,
      disponible: true,
      estado: true,
      createdAt: true,
      categoria: { select: { id: true, nombre: true } },
      // Contamos sin traer los objetos completos
      _count: {
        select: {
          variantes: true,
          insumosBase: true,
        },
      },
    },
    orderBy: { nombre: 'asc' },
  });
};

// ──────────────────────────────────────────────
// PARA: GET /products/:id — Ver producto completo
// ──────────────────────────────────────────────

/**
 * Query completa para vista de detalle — incluye todas las relaciones.
 */
export const findProductoById = async (id) => {
  return prisma.producto.findUnique({
    where: { id },
    include: {
      categoria: { select: { id: true, nombre: true, estado: true } },
      insumosBase: {
        include: {
          itemInventario: {
            select: {
              id: true,
              nombre: true,
              unidadMedida: true,
              stockActual: true,
              costoPromedio: true,
              estado: true,
            },
          },
        },
      },
      variantes: {
        where: { estado: 'ACTIVO' },
        include: {
          insumosAdicionales: {
            include: {
              itemInventario: {
                select: {
                  id: true,
                  nombre: true,
                  unidadMedida: true,
                  stockActual: true,
                  estado: true,
                },
              },
            },
          },
        },
      },
    },
  });
};

// ──────────────────────────────────────────────
// PARA: PUT /products/:id — Editar producto
// ──────────────────────────────────────────────

/**
 * Actualiza el producto y opcionalmente reemplaza la fórmula completa.
 * Reemplazar = borrar todos los insumos actuales + crear los nuevos.
 */
export const updateProducto = async (id, data, insumosBase) => {
  return prisma.$transaction(async (tx) => {
    // 1. Actualizar datos del producto
    await tx.producto.update({
      where: { id },
      data,
    });

    // 2. Si se envían insumosBase, reemplazar la fórmula completa
    if (insumosBase !== undefined) {
      // Borrar fórmula actual
      await tx.insumoProducto.deleteMany({ where: { productoId: id } });

      // Crear nueva fórmula
      if (insumosBase.length > 0) {
        await tx.insumoProducto.createMany({
          data: insumosBase.map((insumo) => ({
            productoId: id,
            itemInventarioId: insumo.itemInventarioId,
            cantidad: insumo.cantidad,
          })),
        });
      }
    }

    // 3. Retornar producto actualizado con relaciones
    return tx.producto.findUnique({
      where: { id },
      include: {
        categoria: { select: { id: true, nombre: true } },
        insumosBase: {
          include: {
            itemInventario: {
              select: { id: true, nombre: true, unidadMedida: true },
            },
          },
        },
        variantes: {
          where: { estado: 'ACTIVO' },
          select: { id: true, nombre: true, precioDiferencial: true, disponible: true },
        },
      },
    });
  });
};

// ──────────────────────────────────────────────
// PARA: PATCH /products/:id/deactivate y activate
// ──────────────────────────────────────────────

export const cambiarEstadoProducto = async (id, estado) => {
  return prisma.producto.update({
    where: { id },
    data: {
      estado,
      // Al desactivar, también marcamos como no disponible
      disponible: estado === 'ACTIVO',
    },
  });
};

// ──────────────────────────────────────────────
// PARA: POST /products/:id/variants
// ──────────────────────────────────────────────

/**
 * Verifica si ya existe una variante con ese nombre en ese producto.
 */
export const findVarianteByNombre = async (nombre, productoId, excluirId = null) => {
  return prisma.variante.findFirst({
    where: {
      nombre: { contains: nombre },
      productoId,
      ...(excluirId && { NOT: { id: excluirId } }),
    },
  });
};

/**
 * Crea la variante con sus insumos adicionales en transacción.
 */
export const createVariante = async ({
  productoId,
  nombre,
  precioDiferencial,
  insumosAdicionales,
}) => {
  return prisma.$transaction(async (tx) => {
    // 1. Crear la variante
    const variante = await tx.variante.create({
      data: {
        productoId,
        nombre,
        precioDiferencial,
        disponible: true,
        estado: 'ACTIVO',
      },
    });

    // 2. Crear insumos adicionales de la variante
    if (insumosAdicionales.length > 0) {
      await tx.insumoVariante.createMany({
        data: insumosAdicionales.map((insumo) => ({
          varianteId: variante.id,
          itemInventarioId: insumo.itemInventarioId,
          cantidad: insumo.cantidad,
        })),
      });
    }

    // 3. Retornar variante con sus insumos
    return tx.variante.findUnique({
      where: { id: variante.id },
      include: {
        insumosAdicionales: {
          include: {
            itemInventario: {
              select: { id: true, nombre: true, unidadMedida: true },
            },
          },
        },
      },
    });
  });
};

// ──────────────────────────────────────────────
// PARA: PUT /products/:id/variants/:variantId
// ──────────────────────────────────────────────

export const findVarianteById = async (id) => {
  return prisma.variante.findUnique({
    where: { id },
    include: {
      insumosAdicionales: {
        include: {
          itemInventario: {
            select: { id: true, nombre: true, unidadMedida: true, stockActual: true },
          },
        },
      },
    },
  });
};

export const updateVariante = async (id, data, insumosAdicionales) => {
  return prisma.$transaction(async (tx) => {
    // 1. Actualizar datos de la variante
    await tx.variante.update({
      where: { id },
      data,
    });

    // 2. Reemplazar insumos adicionales si se enviaron
    if (insumosAdicionales !== undefined) {
      await tx.insumoVariante.deleteMany({ where: { varianteId: id } });

      if (insumosAdicionales.length > 0) {
        await tx.insumoVariante.createMany({
          data: insumosAdicionales.map((insumo) => ({
            varianteId: id,
            itemInventarioId: insumo.itemInventarioId,
            cantidad: insumo.cantidad,
          })),
        });
      }
    }

    return tx.variante.findUnique({
      where: { id },
      include: {
        insumosAdicionales: {
          include: {
            itemInventario: {
              select: { id: true, nombre: true, unidadMedida: true },
            },
          },
        },
      },
    });
  });
};

// ──────────────────────────────────────────────
// PARA: PATCH variante deactivate y activate
// ──────────────────────────────────────────────

export const cambiarEstadoVariante = async (id, estado) => {
  return prisma.variante.update({
    where: { id },
    data: {
      estado,
      disponible: estado === 'ACTIVO',
    },
  });
};