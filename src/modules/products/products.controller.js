// src/modules/products/products.controller.js
//
// Controlador delgado (thin controller):
// Cada función hace exactamente 3 cosas:
// 1. Extrae datos del request
// 2. Llama al servicio
// 3. Responde con ApiResponse
// Nunca hay lógica de negocio aquí.

import * as productsService from './products.service.js';
import { ApiResponse } from '../../utils/response.js';

// ── PRODUCTOS ────────────────────────────────

export const crearProducto = async (req, res, next) => {
  try {
    const producto = await productsService.crearProducto(req.body, req.user.id);
    return ApiResponse.created(res, producto, 'Producto creado exitosamente.');
  } catch (error) { next(error); }
};

export const listarProductos = async (req, res, next) => {
  try {
    const { productos, meta } = await productsService.listarProductos(req.query);
    return ApiResponse.paginated(res, productos, meta, 'Productos obtenidos exitosamente.');
  } catch (error) { next(error); }
};

export const verProducto = async (req, res, next) => {
  try {
    const producto = await productsService.verProducto(req.params.id);
    return ApiResponse.success(res, producto, 'Producto obtenido exitosamente.');
  } catch (error) { next(error); }
};

export const editarProducto = async (req, res, next) => {
  try {
    const producto = await productsService.editarProducto(
      req.params.id, req.body, req.user.id
    );
    return ApiResponse.success(res, producto, 'Producto actualizado exitosamente.');
  } catch (error) { next(error); }
};

export const desactivarProducto = async (req, res, next) => {
  try {
    const producto = await productsService.desactivarProducto(req.params.id, req.user.id);
    return ApiResponse.success(res, producto, 'Producto desactivado exitosamente.');
  } catch (error) { next(error); }
};

export const activarProducto = async (req, res, next) => {
  try {
    const producto = await productsService.activarProducto(req.params.id, req.user.id);
    return ApiResponse.success(res, producto, 'Producto activado exitosamente.');
  } catch (error) { next(error); }
};

// ── VARIANTES ────────────────────────────────

export const crearVariante = async (req, res, next) => {
  try {
    const variante = await productsService.crearVariante(
      req.params.id, req.body, req.user.id
    );
    return ApiResponse.created(res, variante, 'Variante creada exitosamente.');
  } catch (error) { next(error); }
};

export const editarVariante = async (req, res, next) => {
  try {
    const variante = await productsService.editarVariante(
      req.params.id, req.params.variantId, req.body, req.user.id
    );
    return ApiResponse.success(res, variante, 'Variante actualizada exitosamente.');
  } catch (error) { next(error); }
};

export const desactivarVariante = async (req, res, next) => {
  try {
    const variante = await productsService.desactivarVariante(
      req.params.id, req.params.variantId, req.user.id
    );
    return ApiResponse.success(res, variante, 'Variante desactivada exitosamente.');
  } catch (error) { next(error); }
};

export const activarVariante = async (req, res, next) => {
  try {
    const variante = await productsService.activarVariante(
      req.params.id, req.params.variantId, req.user.id
    );
    return ApiResponse.success(res, variante, 'Variante activada exitosamente.');
  } catch (error) { next(error); }
};