// src/modules/cash-register/cash-register.controller.js
import * as cashRegisterService from './cash-register.service.js';
import { ApiResponse } from '../../utils/response.js';

// POST /cash-register/open — Abrir caja
export const abrirCaja = async (req, res, next) => {
  try {
    const caja = await cashRegisterService.abrirCaja(req.body, req.user.id);
    return ApiResponse.created(res, caja, 'Caja abierta exitosamente.');
  } catch (error) {
    next(error);
  }
};

// GET /cash-register/current — Ver caja actual con resumen
export const verCajaActual = async (req, res, next) => {
  try {
    const resultado = await cashRegisterService.verCajaActual();
    return ApiResponse.success(res, resultado, 'Estado actual de la caja.');
  } catch (error) {
    next(error);
  }
};

// GET /cash-register/status — Estado simplificado (para ventas)
export const estadoCaja = async (req, res, next) => {
  try {
    const estado = await cashRegisterService.obtenerEstadoCaja();
    return ApiResponse.success(res, estado, 'Estado de caja obtenido.');
  } catch (error) {
    next(error);
  }
};

// POST /cash-register/close — Cerrar caja
export const cerrarCaja = async (req, res, next) => {
  try {
    const resultado = await cashRegisterService.cerrarCaja(req.body, req.user.id);
    return ApiResponse.success(res, resultado, 'Caja cerrada exitosamente.');
  } catch (error) {
    next(error);
  }
};

// GET /cash-register/history — Historial de cajas
export const historialCajas = async (req, res, next) => {
  try {
    const { cajas, meta } = await cashRegisterService.historialCajas(req.query);
    return ApiResponse.paginated(res, cajas, meta, 'Historial de cajas obtenido.');
  } catch (error) {
    next(error);
  }
};

// GET /cash-register/:id — Ver caja específica
export const verCaja = async (req, res, next) => {
  try {
    const resultado = await cashRegisterService.verCaja(req.params.id);
    return ApiResponse.success(res, resultado, 'Caja obtenida exitosamente.');
  } catch (error) {
    next(error);
  }
};