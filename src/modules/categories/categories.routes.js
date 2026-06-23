// src/modules/categories/categories.routes.js
import { Router } from 'express';
import * as categoriesController from './categories.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize, requireAdmin } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { MODULO, ACCION } from '../../config/constants.js';

const router = Router();
router.use(authenticate); // Todos los endpoints requieren autenticación

export default router;