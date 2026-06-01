// src/utils/errors.js
//
// Las clases de error personalizadas tienen dos ventajas:
// 1. Añaden contexto semántico: un ValidationError es diferente a un AuthError
// 2. Permiten al error handler diferenciar y responder apropiadamente
//
// Todas heredan de AppError, que hereda de Error (built-in de JS).
export class AppError extends Error {
    constructor(message, statusCode=500, code='APP_ERROR'){
        super(message);
        this.statusCode=statusCode;
        this.code=code;
        this.name=this.constructor.name;
        //Captura el stack trace correctamente (solo v8/Node.js)
        Error.captureStackTrace(this, this.constructor);
    }
}

// 400 — Datos de entrada inválidos
export class ValidationError extends AppError{
    constructor(message, errors=[]){
        super(message, 400, 'VALIDATION_ERROR');
        this.errors; // Array de errores de validación especificos
    }
}

//401 - No autenticado (sin token o token inválido)
export class AuthenticationError extends AppError{
    constructor(message = 'No autenticado. se requiere inicio de sesión'){
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}

//403 - aUTENTICADO PERO SIN PERMISOS
export class AuthorizationError extends AppError{
    constructor(message= 'No tienes permisos para realizar esta acción'){
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}

//404 - Recurso no encontrado
export class NotFoundError extends AppError{
    constructor(message= 'Recurso no encontrado.'){
        super(message, 404, 'NOT_FOUND');
    }
}

//409 - conflicto (duplicado, estado inválido)
export class ConflictError extends AppError{
    constructor(message){
        super(message, 409, 'CONFLICT');
    }
}

//423 - Recurso bloqueado (cuenta de usuario bloqueada)
export class AccountLockedError extends AppError{
    constructor(message,minutosRestantes){
        super(message, 423, 'ACCOUNT_LOCKED');
        this.minutosRestantes=minutosRestantes;
    }
}

//Funciones factory (más ergonómicas que `new`)
export const createNotFoundError = (msg)=> new NotFoundError(msg);
export const createValidationError = (msg, errors) => new ValidationError(msg, errors);
export const createAuthError = (msg) => new AuthenticationError(msg);
export const createForbiddenError = (msg) => new AuthorizationError(msg);
export const createConflictError =(msg)=> new ConflictError(msg)