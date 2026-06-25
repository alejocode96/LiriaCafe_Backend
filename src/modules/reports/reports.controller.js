// src/modules/reports/reports.controller.js
import * as reportsService from './reports.service.js';
import { ApiResponse } from '../../utils/response.js';

export const reporteVentas = async (req, res, next) => {
  try {
    const reporte = await reportsService.reporteVentas(req.query);
    return ApiResponse.success(res, reporte, 'Reporte de ventas generado exitosamente.');
  } catch (error) { next(error); }
};

export const reporteRentabilidad = async (req, res, next) => {
  try {
    const reporte = await reportsService.reporteRentabilidad(req.query);
    return ApiResponse.success(res, reporte, 'Reporte de rentabilidad generado exitosamente.');
  } catch (error) { next(error); }
};

export const reporteInventario = async (req, res, next) => {
  try {
    const reporte = await reportsService.reporteInventario(req.query);
    return ApiResponse.success(res, reporte, 'Reporte de inventario generado exitosamente.');
  } catch (error) { next(error); }
};

export const reporteCaja = async (req, res, next) => {
  try {
    const reporte = await reportsService.reporteCaja(req.query);
    return ApiResponse.success(res, reporte, 'Reporte de caja generado exitosamente.');
  } catch (error) { next(error); }
};

export const dashboard = async (req, res, next) => {
  try {
    const data = await reportsService.dashboard(req.query);
    return ApiResponse.success(res, data, 'Dashboard obtenido exitosamente.');
  } catch (error) { next(error); }
};