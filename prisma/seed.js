// prisma/seed.js
//
// El seed crea los datos mínimos necesarios para que el sistema funcione.
// Se ejecuta con: npm run db:seed
//
// En este caso: el usuario administrador inicial y las categorías
// de movimiento de flujo de caja básicas.
//
// IMPORTANTE: El seed es IDEMPOTENTE — puedes ejecutarlo múltiples veces
// sin duplicar datos (usa upsert o verifica antes de crear).

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const seed = async () => {
  console.log('🌱 Iniciando seed de la base de datos...\n');

  // ────────────────────────────────────────────
  // 1. ROL ADMINISTRADOR
  // ────────────────────────────────────────────
  console.log('Creando rol Administrador...');

  const rolAdmin = await prisma.rol.upsert({
    where: { nombre: 'ADMINISTRADOR' },
    update: {},  // Si ya existe, no modificar
    create: {
      nombre: 'ADMINISTRADOR',
      descripcion: 'Rol con acceso total al sistema. Predefinido e inmutable.',
      esAdmin: true,
      estado: 'ACTIVO',
    },
  });

  console.log(`Rol "${rolAdmin.nombre}" listo (ID: ${rolAdmin.id})`);

  // ────────────────────────────────────────────
  // 2. USUARIO ADMINISTRADOR INICIAL
  // ────────────────────────────────────────────
  console.log('\nCreando usuario administrador...');

  const adminPassword = 'Admin123!@#';  // Contraseña temporal inicial
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const adminUsuario = await prisma.usuario.upsert({
    where: { nombreUsuario: 'admin' },
    update: {},
    create: {
      nombreCompleto: 'Administrador del Sistema',
      nombreUsuario: 'admin',
      correo: 'admin@pos.local',
      passwordHash,
      estado: 'ACTIVO',
      requiereCambioClave: true,  // Debe cambiar la contraseña en el primer login
      rolId: rolAdmin.id,
    },
  });

  // Guardar en historial de contraseñas
  await prisma.historialContrasena.upsert({
    where: { id: 'seed-admin-password' },
    update: {},
    create: {
      id: 'seed-admin-password',
      usuarioId: adminUsuario.id,
      passwordHash,
    },
  });

  console.log(`   ✅ Usuario admin creado`);
  console.log(`   📧 Correo: admin@pos.local`);
  console.log(`   👤 Usuario: admin`);
  console.log(`   🔑 Contraseña temporal: ${adminPassword}`);
  console.log(`   ⚠️  El sistema pedirá cambiar la contraseña en el primer login`);

  // ────────────────────────────────────────────
  // 3. CATEGORÍAS DE MOVIMIENTO DE FLUJO DE CAJA
  // (Requerimiento sección 9.3)
  // ────────────────────────────────────────────
  console.log('\n💰 Creando categorías de movimiento de flujo de caja...');

  const categorias = [
    { nombre: 'Arriendo', descripcion: 'Pago de arrendamiento del local' },
    { nombre: 'Servicios Públicos', descripcion: 'Agua, luz, gas, internet' },
    { nombre: 'Nómina', descripcion: 'Pago de salarios y prestaciones' },
    { nombre: 'Proveedores', descripcion: 'Pago a proveedores de insumos' },
    { nombre: 'Imprevistos', descripcion: 'Gastos no planificados' },
    { nombre: 'Reposición de Caja', descripcion: 'Ingreso para base de caja' },
    { nombre: 'Anticipo Cliente', descripcion: 'Anticipo recibido de cliente' },
    { nombre: 'Compra de Inventario', descripcion: 'Compra de insumos y materias primas' },
  ];

  for (const cat of categorias) {
    await prisma.categoriaMovimiento.upsert({
      where: { nombre: cat.nombre },
      update: {},
      create: { ...cat, estado: 'ACTIVO' },
    });
    console.log(`   ✅ ${cat.nombre}`);
  }

  // ────────────────────────────────────────────
  // 4. CONFIGURACIÓN INICIAL DEL NEGOCIO
  // ────────────────────────────────────────────
  console.log('\n⚙️  Creando configuración inicial del negocio...');

  const configuraciones = [
    { clave: 'NOMBRE_NEGOCIO', valor: 'Mi Cafetería', descripcion: 'Nombre del establecimiento' },
    { clave: 'NIT', valor: '900.000.000-0', descripcion: 'NIT o identificación fiscal' },
    { clave: 'DIRECCION', valor: 'Calle 1 # 2-3', descripcion: 'Dirección del establecimiento' },
    { clave: 'TELEFONO', valor: '3001234567', descripcion: 'Teléfono de contacto' },
    { clave: 'IVA_PORCENTAJE', valor: '0', descripcion: 'Porcentaje de IVA aplicable' },
    { clave: 'MONEDA', valor: 'COP', descripcion: 'Moneda del sistema' },
    { clave: 'FORMATO_FECHA', valor: 'DD/MM/YYYY', descripcion: 'Formato de fecha en reportes' },
  ];

  for (const config of configuraciones) {
    await prisma.configuracionNegocio.upsert({
      where: { clave: config.clave },
      update: {},
      create: config,
    });
  }

  console.log('   ✅ Configuración inicial creada');

  console.log('\n🎉 Seed completado exitosamente!\n');
  console.log('═══════════════════════════════════════');
  console.log('  CREDENCIALES DEL ADMINISTRADOR');
  console.log('═══════════════════════════════════════');
  console.log(`  Usuario:    admin`);
  console.log(`  Contraseña: ${adminPassword}`);
  console.log(`  ⚠️  Cambia la contraseña inmediatamente`);
  console.log('═══════════════════════════════════════\n');
};

seed()
  .catch((error) => {
    console.error('❌ Error en el seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });