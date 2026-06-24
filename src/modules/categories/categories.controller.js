// src/modules/categories/categories.controller.js
//
// El controlador es DELGADO (thin controller).
// Solo extrae datos del request, llama al servicio y responde.
// Nunca contiene lógica de negocio.

import * as categoriesService from './categories.service.js';
import { ApiResponse } from '../../utils/response.js';

export const crearCategoria = async (req, res, next) => {
  try {
    const categoria = await categoriesService.crearCategoria(req.body, req.user.id);
    return ApiResponse.created(res, categoria, 'Categoría creada exitosamente.');
  } catch (error) {
    next(error);
  }
};

export const listarCategorias = async (req, res, next) => {
  try {
    const { categorias, meta } = await categoriesService.listarCategorias(req.query);
    return ApiResponse.paginated(res, categorias, meta, 'Categorías obtenidas exitosamente.');
  } catch (error) {
    next(error);
  }
};

export const verCategoria = async (req, res, next) => {
  try {
    const categoria = await categoriesService.verCategoria(req.params.id);
    return ApiResponse.success(res, categoria, 'Categoría obtenida exitosamente.');
  } catch (error) {
    next(error);
  }
};

export const editarCategoria = async (req, res, next) => {
  try {
    const categoria = await categoriesService.editarCategoria(
      req.params.id,
      req.body,
      req.user.id
    );
    return ApiResponse.success(res, categoria, 'Categoría actualizada exitosamente.');
  } catch (error) {
    next(error);
  }
};

export const desactivarCategoria = async (req, res, next) => {
  try {
    const resultado = await categoriesService.desactivarCategoria(
      req.params.id,
      req.user.id
    );
    return ApiResponse.success(res, resultado, 'Categoría desactivada exitosamente.');
  } catch (error) {
    next(error);
  }
};

// AGREGAR al final de categories.controller.js
export const activarCategoria = async (req, res, next) => {
  try {
    const categoria = await categoriesService.activarCategoria(
      req.params.id,
      req.user.id
    );
    return ApiResponse.success(res, categoria, 'Categoría activada exitosamente.');
  } catch (error) {
    next(error);
  }
};