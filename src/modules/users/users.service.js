// src/modules/users/users.service.js
import * as usersRepository from './users.repository.js';
import { registrarAuditoria } from '../../middlewares/audit.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { hashPassword } from '../../utils/bcrypt.js';
import { validatePasswordPolicy } from '../../utils/password-validator.js';
import {
  ConflictError,
  NotFoundError,
  AuthorizationError,
  ValidationError,
} from '../../utils/errors.js';
import { logger } from '../../logger/index.js';

// ──────────────────────────────────────────────
// CREAR USUARIO
// ──────────────────────────────────────────────
export const crearUsuario= async(
    {nombreCompleto, nombreUsuario, correo, contrasena, rolId},
    adminId// ID del admin que crea el usuario -para auditoria
)=>{
     // REGLA 1: Verificar unicidad de correo y nombre de usuario
    const usuarioExistente = await usersRepository.existeUsuario(correo, nombreUsuario);
    if (usuarioExistente) {
        // Mensaje específico según qué campo está duplicado
        const campo = usuarioExistente.correo === correo
        ? 'correo electrónico'
        : 'nombre de usuario';
        throw new ConflictError(`El ${campo} "${usuarioExistente.correo === correo ? correo : nombreUsuario}" ya está en uso por otro usuario.`);
    }

    //REGLA 2: El rol debe existir y estar activo
    const rol = await usersRepository.findRolActivo(rolId);
    if(!rol){
        throw new NotFoundError(
            'El rol especificado no existe o está inactivo. Solo puedes asignar roles activos.'
        );
    }

    //REGLA 3: Validar política de la contraseña temporal
    //Aunque es temporal debe ser segura desde el inicio
    const politica = validatePasswordPolicy(contrasena);
    if(!politica.valid){
        throw new ValidationError(
            'La contraseña temporal no cumple con la política de seguridad',
            politica.errors.map((msg)=>({
                campo: 'contrasena',
                mensaje: msg,
                codigo:'password_policy',
            }))
        );
    }

    // REGLA 4: hashear la contraseña antes de guardar
    const passwordHash = await hashPassword(contrasena);

    //crear el usuario en la BD
    const usuario = await usersRepository.createUsuario({
        nombreCompleto,
        nombreUsuario,
        correo,
        passwordHash,
        rolId,
        creadoPorId: adminId,
    });

    // Registrar en auditoría (quién, qué, cuándo)
    await registrarAuditoria({
        accion: 'CREAR_USUARIO',
        usuarioId: adminId,
        entidad: 'Usuario',
        entidadId: usuario.id,
        detalle:{
            nombreUsuario: usuario.nombreUsuario,
            correo: usuario.correo,
            rol: rol.nombre,
        },
    });

    logger.info('Usuario creado',{
        usuarioId: usuario.id,
        nombreUsuario,
        rolId,
        creadoPorId:adminId,
    });

    return usuario;
};