// src/routes/index.js
//
// Este archivo centraliza el registro de todas las rutas del sistema.
// Cada módulo registra sus propias rutas con su prefijo correspondiente.
// Agregar un nuevo módulo = agregar dos líneas aquí.

import {env} from '../config/environment.js';

// Importación de routers de cada módulo
import authRoutes from '../modules/auth/auth.routes.js';
import rolesRoutes from '../modules/roles/roles.routes.js';
import usersRoutes from '../modules/users/users.routes.js';

import categoriesRoutes from '../modules/categories/categories.routes.js';
// import inventoryRoutes from '../modules/inventory/inventory.routes.js';
// import productsRoutes from '../modules/products/products.routes.js';
// import cashRegisterRoutes from '../modules/cash-register/cash-register.routes.js';
// import salesRoutes from '../modules/sales/sales.routes.js';
// import cashFlowRoutes from '../modules/cash-flow/cash-flow.routes.js';
// import reportsRoutes from '../modules/reports/reports.routes.js';


export const setupRoutes = (app) =>{
    const apiPrefix= `/api/${env.API_VERSION}`;
    //Health Check: verifica que el servidor esté vivo
    // Los sitemas de monitoreo y balanceadores de carga usan este endpoint
    app.get('/api/health', (req, res)=>{
        res.json({
            status:'ok',
            timestamp: new Date().toISOString(),
            version: env.API_VERSION,
            environment:env.NODE_ENV,
        });
    });

    // Registro de rutas por módulo
    // Cada prefijo refleja exactamente el dominio del negocio
    app.use(`${apiPrefix}/auth`, authRoutes);
    app.use(`${apiPrefix}/users`, usersRoutes);
    app.use(`${apiPrefix}/roles`, rolesRoutes);
    app.use(`${apiPrefix}/categories`, categoriesRoutes);
    // app.use(`${apiPrefix}/inventory`, inventoryRoutes);
    // app.use(`${apiPrefix}/products`, productsRoutes);
    // app.use(`${apiPrefix}/cash-register`, cashRegisterRoutes);
    // app.use(`${apiPrefix}/sales`, salesRoutes);
    // app.use(`${apiPrefix}/cash-flow`, cashFlowRoutes);
    // app.use(`${apiPrefix}/reports`, reportsRoutes);
};