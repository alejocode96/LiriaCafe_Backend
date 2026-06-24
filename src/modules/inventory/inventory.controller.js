// src/modules/inventory/inventory.controller.js
import * as inventoryService from './inventory.service.js';
import { ApiResponse } from '../../utils/response.js';

export const crearItem = async (req, res, next) => {
  try {
    const item = await inventoryService.crearItem(req.body, req.user.id);
    return ApiResponse.created(res, item, 'Ítem de inventario creado exitosamente.');
  } catch (error) {
    next(error);
  }
};

export const listarItems = async (req, res, next) => {
  try {
    const { items, meta } = await inventoryService.listarItems(req.query);
    return ApiResponse.paginated(res, items, meta, 'Ítems obtenidos exitosamente.');
  } catch (error) {
    next(error);
  }
};

export const verItem = async (req, res, next) => {
  try {
    const item = await inventoryService.verItem(req.params.id);
    return ApiResponse.success(res, item, 'Ítem obtenido exitosamente.');
  } catch (error) {
    next(error);
  }
};

export const editarItem = async (req, res, next) => {
  try {
    const item = await inventoryService.editarItem(
      req.params.id,
      req.body,
      req.user.id
    );
    return ApiResponse.success(res, item, 'Ítem actualizado exitosamente.');
  } catch (error) {
    next(error);
  }
};

export const desactivarItem = async (req, res, next) => {
  try {
    const item = await inventoryService.desactivarItem(req.params.id, req.user.id);
    return ApiResponse.success(res, item, 'Ítem desactivado exitosamente.');
  } catch (error) {
    next(error);
  }
};

export const registrarEntrada = async (req, res, next) => {
  try {
    const resultado = await inventoryService.registrarEntrada(
      req.params.id,
      req.body,
      req.user.id
    );
    return ApiResponse.created(
      res,
      resultado,
      'Entrada de inventario registrada. Stock y costo promedio actualizados.'
    );
  } catch (error) {
    next(error);
  }
};

export const verKardex = async (req, res, next) => {
  try {
    const resultado = await inventoryService.verKardex(req.params.id, req.query);
    return ApiResponse.paginated(
      res,
      resultado.movimientos,
      resultado.meta,
      `Kardex del ítem "${resultado.item.nombre}".`
    );
  } catch (error) {
    next(error);
  }
};

// AGREGAR al final de inventory.controller.js
export const activarItem = async (req, res, next) => {
  try {
    const item = await inventoryService.activarItem(req.params.id, req.user.id);
    return ApiResponse.success(res, item, 'Ítem activado exitosamente.');
  } catch (error) {
    next(error);
  }
};