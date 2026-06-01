// src/config/constants.js
//
// Centralizar las constantes del negocio evita "magic strings" dispersas
// por todo el código. En lugar de escribir 'ACTIVO' o 'activo' en 20 archivos,
// importamos ESTADO.ACTIVO. Si algún día cambia el valor, solo cambia aquí.
export const ESTADO ={
    ACTIVO: 'ACTIVO',
    INACTIVO: 'INACTIVO',
};

//Módulos del sistema - usados en la matriz de permisos
export const MODULO={
    USUARIOS:'USUARIOS',
    ROLES:'ROLES',
    CATEGORIAS:'CATEGORIAS',
    INVENTARIO:'INVENTARIO',
    PRODUCTOS:'PRODUCTOS',
    CAJA:'CAJA',
    VENTAS:'VENTAS',
    FLUJO_CAJA:'FLUJO_CAJA',
    REPORTES:'REPORTES',
    ADMINISTRACION:'ADMINISTRACION'
}

//Acciones controladas por permisos RBAC
export const ACCION={
    CREAR: 'CREAR',
    VER: 'VER',
    EDITAR: 'EDITAR',
    DESACTIVAR: 'DESACTIVAR',
    REPORTES: 'REPORTES',

};

//Estado de ventas
export const ESTADO_VENTA={
    COMPLETADA:'COMPLETADA',
    ANULADA:'ANULADA'
};

//Métodos de pago habilitados
export const METODO_PAGO={
    EFECTIVO:'EFECTIVO',
    TRANSFERENCIA: 'TRANSFERENCIA',
    COMBINADO: 'COMBINADO',
};

//Tipos de movimiento de flujo de caja
export const TIPO_MOVIMIENTO={
    INGRESO:'INGRESO',
    EGRESO:'EGRESO',
    COMPRA_INVENTARIO:'COMPRA_INVENTARIO',

};

// Estado de caja
export const ESTADO_CAJA = {
    ABIERTA: 'ABIERTA',
    CERRADA: 'CERRADA',
};

// El rol administrador es especial: predefinido, no puede modificarse
export const ROL_ADMIN ='ADMINISTRADOR';

//Nombre del rol administrador raíz (seed)
export const ADMIN_USERNAME='admin';