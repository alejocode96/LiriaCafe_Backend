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



// ──────────────────────────────────────────────
// LISTAR USUARIOS
// ──────────────────────────────────────────────
export const listarUsuarios = async (query) => {
  const { page, limit, skip } = parsePagination(query);

  // Construir filtros dinámicamente
  const where = {};

  if (query.estado) {
    where.estado = query.estado;
  }

  if (query.rolId) {
    where.rolId = query.rolId;
  }

  if (query.buscar) {
    // Búsqueda en múltiples campos simultáneamente
    where.OR = [
      { nombreCompleto: { contains: query.buscar } },
      { nombreUsuario: { contains: query.buscar.toLowerCase() } },
      { correo: { contains: query.buscar.toLowerCase() } },
    ];
  }

  // Ejecutar count y findMany en paralelo — más eficiente que secuencial
  const [total, usuarios] = await Promise.all([
    usersRepository.countUsuarios(where),
    usersRepository.findUsuarios({ where, skip, take: limit }),
  ]);

  return {
    usuarios,
    meta: buildPaginationMeta(total, page, limit),
  };
};


// ──────────────────────────────────────────────
// VER USUARIO POR ID
// ──────────────────────────────────────────────
export const verUsuario = async (id) => {
  const usuario = await usersRepository.findUsuarioById(id);

  if (!usuario) {
    throw new NotFoundError(`No se encontró un usuario con ID: ${id}`);
  }

  return usuario;
};


// ──────────────────────────────────────────────
// EDITAR USUARIO
// ──────────────────────────────────────────────
export const editarUsuario = async (id, datos, adminId) => {

  // REGLA 1: El usuario debe existir
  const usuarioActual = await usersRepository.findUsuarioById(id);
  if (!usuarioActual) {
    throw new NotFoundError(`No se encontró un usuario con ID: ${id}`);
  }

  // REGLA 2: No se puede editar al propio admin raíz cambiándole el rol
  // (protección extra — el admin siempre debe tener su rol)
  if (usuarioActual.rol.esAdmin && datos.rolId && datos.rolId !== usuarioActual.rol.id) {
    throw new AuthorizationError(
      'No se puede cambiar el rol del usuario Administrador principal.'
    );
  }

  // REGLA 3: Si cambia correo o username, verificar unicidad
  if (datos.correo || datos.nombreUsuario) {
    const enUso = await usersRepository.existeUsuario(
      datos.correo ?? usuarioActual.correo,
      datos.nombreUsuario ?? usuarioActual.nombreUsuario,
      id  // Excluir el propio registro de la verificación
    );
    if (enUso) {
      const campo = enUso.correo === (datos.correo ?? '') ? 'correo electrónico' : 'nombre de usuario';
      throw new ConflictError(`El ${campo} ya está en uso por otro usuario.`);
    }
  }

  // REGLA 4: Si cambia el rol, verificar que el nuevo rol existe y está activo
  if (datos.rolId && datos.rolId !== usuarioActual.rol.id) {
    const rolNuevo = await usersRepository.findRolActivo(datos.rolId);
    if (!rolNuevo) {
      throw new NotFoundError('El rol especificado no existe o está inactivo.');
    }
  }

  // Construir solo los datos que cambian
  const datosActualizar = {};
  if (datos.nombreCompleto) datosActualizar.nombreCompleto = datos.nombreCompleto;
  if (datos.nombreUsuario) datosActualizar.nombreUsuario = datos.nombreUsuario;
  if (datos.correo) datosActualizar.correo = datos.correo;
  if (datos.rolId) datosActualizar.rolId = datos.rolId;

  const usuarioActualizado = await usersRepository.updateUsuario(id, datosActualizar, adminId);

  await registrarAuditoria({
    accion: 'EDITAR_USUARIO',
    usuarioId: adminId,
    entidad: 'Usuario',
    entidadId: id,
    detalle: {
      antes: {
        nombreCompleto: usuarioActual.nombreCompleto,
        correo: usuarioActual.correo,
        rol: usuarioActual.rol.nombre,
      },
      despues: datosActualizar,
    },
  });

  logger.info('Usuario editado', { usuarioId: id, adminId, cambios: Object.keys(datosActualizar) });

  return usuarioActualizado;
};


// ──────────────────────────────────────────────
// DESACTIVAR USUARIO
// ──────────────────────────────────────────────
export const desactivarUsuario = async (id, adminId) => {

  const usuario = await usersRepository.findUsuarioById(id);
  if (!usuario) {
    throw new NotFoundError(`No se encontró un usuario con ID: ${id}`);
  }

  // REGLA 1: No desactivar si ya está inactivo
  if (usuario.estado === 'INACTIVO') {
    throw new ConflictError('El usuario ya está desactivado.');
  }

  // REGLA 2: No desactivar al propio usuario admin que hace la acción
  if (id === adminId) {
    throw new AuthorizationError('No puedes desactivar tu propia cuenta.');
  }

  // REGLA 3: Proteger al último administrador activo del sistema
  if (usuario.rol.esAdmin) {
    const adminsActivos = await usersRepository.contarAdminsActivos();
    if (adminsActivos <= 1) {
      throw new AuthorizationError(
        'No se puede desactivar al único administrador activo del sistema.'
      );
    }
  }

  const usuarioDesactivado = await usersRepository.cambiarEstadoUsuario(
    id, 'INACTIVO', adminId
  );

  await registrarAuditoria({
    accion: 'DESACTIVAR_USUARIO',
    usuarioId: adminId,
    entidad: 'Usuario',
    entidadId: id,
    detalle: { nombreUsuario: usuario.nombreUsuario },
  });

  logger.info('Usuario desactivado', { usuarioId: id, adminId });

  return usuarioDesactivado;
};


export const reactivarUsuario = async (id, adminId) => {
  const usuario = await usersRepository.findUsuarioById(id);
  if (!usuario) {
    throw new NotFoundError(`No se encontró un usuario con ID: ${id}`);
  }

  if (usuario.estado === 'ACTIVO') {
    throw new ConflictError('El usuario ya está activo.');
  }

  const usuarioReactivado = await usersRepository.cambiarEstadoUsuario(
    id, 'ACTIVO', adminId
  );

  await registrarAuditoria({
    accion: 'REACTIVAR_USUARIO',
    usuarioId: adminId,
    entidad: 'Usuario',
    entidadId: id,
    detalle: { nombreUsuario: usuario.nombreUsuario },
  });

  logger.info('Usuario reactivado', { usuarioId: id, adminId });
  return usuarioReactivado;
};



export const desbloquearCuenta = async (id, adminId) => {
  const usuario = await usersRepository.findUsuarioById(id);
  if (!usuario) {
    throw new NotFoundError(`No se encontró un usuario con ID: ${id}`);
  }

  // Verificar que realmente está bloqueado
  if (!usuario.bloqueadoPermanente && !usuario.bloqueadoHasta) {
    throw new ConflictError('La cuenta no está bloqueada.');
  }

  const usuarioDesbloqueado = await usersRepository.desbloquearUsuario(id, adminId);

  await registrarAuditoria({
    accion: 'DESBLOQUEAR_CUENTA',
    usuarioId: adminId,
    entidad: 'Usuario',
    entidadId: id,
    detalle: { nombreUsuario: usuario.nombreUsuario },
  });

  logger.info('Cuenta desbloqueada', { usuarioId: id, adminId });
  return usuarioDesbloqueado;
};

export const forzarCambioContrasena = async (id, adminId) => {
  const usuario = await usersRepository.findUsuarioById(id);
  if (!usuario) {
    throw new NotFoundError(`No se encontró un usuario con ID: ${id}`);
  }

  if (usuario.requiereCambioClave) {
    throw new ConflictError('El usuario ya tiene pendiente un cambio de contraseña.');
  }

  const usuarioActualizado = await usersRepository.forzarCambioContrasena(id, adminId);

  await registrarAuditoria({
    accion: 'FORZAR_CAMBIO_CONTRASENA',
    usuarioId: adminId,
    entidad: 'Usuario',
    entidadId: id,
    detalle: { nombreUsuario: usuario.nombreUsuario },
  });

  logger.info('Cambio de contraseña forzado', { usuarioId: id, adminId });
  return usuarioActualizado;
};