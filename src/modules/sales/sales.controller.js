// src/modules/sales/sales.controller.js
import * as salesService from './sales.service.js';
import { ApiResponse } from '../../utils/response.js';

export const crearVenta = async (req, res, next) => {
  try {
    const venta = await salesService.crearVenta(req.body, req.user.id);
    return ApiResponse.created(res, venta, `Venta #${venta.numero} registrada exitosamente.`);
  } catch (error) {
    next(error);
  }
};

export const listarVentas = async (req, res, next) => {
  try {
    const { ventas, meta } = await salesService.listarVentas(req.query);
    return ApiResponse.paginated(res, ventas, meta, 'Ventas obtenidas exitosamente.');
  } catch (error) {
    next(error);
  }
};

export const verVenta = async (req, res, next) => {
  try {
    const venta = await salesService.verVenta(req.params.id);
    return ApiResponse.success(res, venta, 'Venta obtenida exitosamente.');
  } catch (error) {
    next(error);
  }
};

export const anularVenta = async (req, res, next) => {
  try {
    const venta = await salesService.anularVenta(req.params.id, req.body, req.user.id);
    return ApiResponse.success(res, venta, `Venta #${venta.numero} anulada exitosamente.`);
  } catch (error) {
    next(error);
  }
};