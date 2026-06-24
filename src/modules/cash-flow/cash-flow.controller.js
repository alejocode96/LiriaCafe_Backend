// src/modules/cash-flow/cash-flow.controller.js
import * as cashFlowService from './cash-flow.service.js';
import { ApiResponse } from '../../utils/response.js';

// ── CATEGORÍAS ────────────────────────────────

export const crearCategoriaMov = async (req, res, next) => {
  try {
    const categoria = await cashFlowService.crearCategoriaMov(req.body, req.user.id);
    return ApiResponse.created(res, categoria, 'Categoría de movimiento creada exitosamente.');
  } catch (error) { next(error); }
};

export const listarCategoriasMov = async (req, res, next) => {
  try {
    const { categorias, meta } = await cashFlowService.listarCategoriasMov(req.query);
    return ApiResponse.paginated(res, categorias, meta, 'Categorías obtenidas exitosamente.');
  } catch (error) { next(error); }
};

export const desactivarCategoriaMov = async (req, res, next) => {
  try {
    const categoria = await cashFlowService.desactivarCategoriaMov(req.params.id, req.user.id);
    return ApiResponse.success(res, categoria, 'Categoría desactivada exitosamente.');
  } catch (error) { next(error); }
};

export const activarCategoriaMov = async (req, res, next) => {
  try {
    const categoria = await cashFlowService.activarCategoriaMov(req.params.id, req.user.id);
    return ApiResponse.success(res, categoria, 'Categoría activada exitosamente.');
  } catch (error) { next(error); }
};

// ── MOVIMIENTOS ───────────────────────────────

export const registrarMovimiento = async (req, res, next) => {
  try {
    const movimiento = await cashFlowService.registrarMovimiento(req.body, req.user.id);
    return ApiResponse.created(res, movimiento, 'Movimiento registrado exitosamente.');
  } catch (error) { next(error); }
};

export const listarMovimientos = async (req, res, next) => {
  try {
    const { movimientos, meta } = await cashFlowService.listarMovimientos(req.query);
    return ApiResponse.paginated(res, movimientos, meta, 'Movimientos obtenidos exitosamente.');
  } catch (error) { next(error); }
};

export const verMovimiento = async (req, res, next) => {
  try {
    const movimiento = await cashFlowService.verMovimiento(req.params.id);
    return ApiResponse.success(res, movimiento, 'Movimiento obtenido exitosamente.');
  } catch (error) { next(error); }
};

// ── RESUMEN ───────────────────────────────────

export const resumenFinanciero = async (req, res, next) => {
  try {
    const resumen = await cashFlowService.resumenFinanciero(req.query);
    return ApiResponse.success(res, resumen, 'Resumen financiero obtenido exitosamente.');
  } catch (error) { next(error); }
};