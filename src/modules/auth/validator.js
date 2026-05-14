// ==========================================================
// VALIDADORES DE AUTENTICACIÓN
// ==========================================================
//
// Este módulo contiene las reglas de validación
// para endpoints relacionados con autenticación.
//
// Tecnologías utilizadas:
//
// ✅ express-validator
// ✅ middleware Express
// ✅ validación y sanitización
//
// Objetivos:
//
// - Validar datos de entrada
// - Sanitizar inputs
// - Evitar datos inválidos
// - Reducir riesgos de seguridad
// - Centralizar validaciones
//
// Porque confiar en lo que envía el frontend
// es una forma extremadamente creativa de sufrir.
//
// ==========================================================



// ==========================================================
// IMPORTACIONES
// ==========================================================


// ----------------------------------------------------------
// express-validator
// ----------------------------------------------------------
//
// Librería especializada para validación
// y sanitización de requests en Express.
//
// body():
// permite validar campos del req.body.
//
// validationResult():
// obtiene errores generados durante validación.
//
// ----------------------------------------------------------

const {
  body,
  validationResult,
} = require('express-validator');



// ----------------------------------------------------------
// Helper de respuesta HTTP
// ----------------------------------------------------------
//
// badRequest():
// helper personalizado para responder errores 400.
//
// Probablemente retorna algo como:
//
// {
//   success: false,
//   message: "Datos inválidos",
//   errors: [...]
// }
//
// Centralizar respuestas mantiene consistencia API.
// Milagro rarísimo en muchos backends.
//
// ----------------------------------------------------------

const { badRequest } = require('../../utils/response');





// ==========================================================
// REGLAS DE VALIDACIÓN LOGIN
// ==========================================================
//
// loginRules:
// arreglo de middlewares de validación.
//
// Se utilizará en rutas como:
//
// POST /auth/login
//
// Flujo:
//
// Request
//   ↓
// loginRules
//   ↓
// validate
//   ↓
// controller
//
// ==========================================================

const loginRules = [



  // ========================================================
  // VALIDACIÓN USERNAME
  // ========================================================
  //
  // body('username')
  //
  // Valida el campo:
  //
  // req.body.username
  //
  // ========================================================

  body('username')


    // ------------------------------------------------------
    // trim()
    // ------------------------------------------------------
    //
    // Elimina espacios al inicio y final.
    //
    // Ejemplo:
    //
    // "   admin   "
    //
    // Resultado:
    //
    // "admin"
    //
    // Evita errores absurdos de autenticación.
    // Sorprendentemente comunes.
    //
    // ------------------------------------------------------

    .trim()



    // ------------------------------------------------------
    // notEmpty()
    // ------------------------------------------------------
    //
    // Valida que el campo NO esté vacío.
    //
    // Si falla:
    //
    // "Usuario requerido"
    //
    // ------------------------------------------------------

    .notEmpty()
    .withMessage('Usuario requerido')



    // ------------------------------------------------------
    // isLength()
    // ------------------------------------------------------
    //
    // Valida longitud mínima y máxima.
    //
    // min: 3
    // max: 50
    //
    // Evita:
    //
    // ❌ usuarios absurdamente cortos
    // ❌ payloads gigantes
    //
    // ------------------------------------------------------

    .isLength({ min: 3, max: 50 })

    .withMessage(
      'Usuario debe tener entre 3 y 50 caracteres'
    )



    // ------------------------------------------------------
    // matches()
    // ------------------------------------------------------
    //
    // Valida usando expresión regular.
    //
    // Regex:
    //
    // /^[a-zA-Z0-9_]+$/
    //
    // Permite únicamente:
    //
    // ✅ letras
    // ✅ números
    // ✅ guion bajo (_)
    //
    // Bloquea:
    //
    // ❌ espacios
    // ❌ símbolos extraños
    // ❌ caracteres especiales
    //
    // Ayuda contra:
    //
    // - datos inválidos
    // - inputs maliciosos
    // - payloads raros
    //
    // Porque internet está lleno de personas
    // intentando meter SQL en cualquier textbox.
    //
    // ------------------------------------------------------

    .matches(/^[a-zA-Z0-9_]+$/)

    .withMessage(
      'Usuario solo puede contener letras, números y guion bajo'
    )



    // ------------------------------------------------------
    // escape()
    // ------------------------------------------------------
    //
    // Sanitiza caracteres HTML peligrosos.
    //
    // Convierte:
    //
    // <script>
    //
    // en:
    //
    // &lt;script&gt;
    //
    // Ayuda a reducir riesgos XSS.
    //
    // No reemplaza seguridad completa,
    // pero suma protección.
    //
    // La seguridad en backend es capas sobre capas.
    // Como paranoia organizada.
    //
    // ------------------------------------------------------

    .escape(),




  // ========================================================
  // VALIDACIÓN PASSWORD
  // ========================================================

  body('password')


    // ------------------------------------------------------
    // notEmpty()
    // ------------------------------------------------------
    //
    // Verifica que exista contraseña.
    //
    // ------------------------------------------------------

    .notEmpty()

    .withMessage('Contraseña requerida')



    // ------------------------------------------------------
    // isLength()
    // ------------------------------------------------------
    //
    // Longitud permitida:
    //
    // min: 6
    // max: 100
    //
    // Beneficios:
    //
    // ✅ evita passwords débiles
    // ✅ limita payloads enormes
    //
    // Aunque sí:
    // habrá usuarios poniendo:
    //
    // 123456
    //
    // con absoluta confianza espiritual.
    //
    // ------------------------------------------------------

    .isLength({ min: 6, max: 100 })

    .withMessage(
      'Contraseña debe tener entre 6 y 100 caracteres'
    ),
];






// ==========================================================
// MIDDLEWARE VALIDATE
// ==========================================================
//
// Middleware encargado de revisar
// si express-validator encontró errores.
//
// Uso:
//
// router.post(
//   '/login',
//   loginRules,
//   validate,
//   loginController
// );
//
// ==========================================================

const validate = (req, res, next) => {


  // ========================================================
  // OBTENER ERRORES
  // ========================================================
  //
  // validationResult(req)
  //
  // Analiza todas las validaciones ejecutadas.
  //
  // Retorna:
  //
  // - errores encontrados
  // - array vacío si todo correcto
  //
  // ========================================================

  const errors = validationResult(req);




  // ========================================================
  // VALIDAR SI EXISTEN ERRORES
  // ========================================================
  //
  // isEmpty()
  //
  // true  → sin errores
  // false → existen errores
  //
  // ========================================================

  if (!errors.isEmpty()) {


    // ------------------------------------------------------
    // RESPUESTA ERROR 400
    // ------------------------------------------------------
    //
    // Retorna:
    //
    // HTTP 400 Bad Request
    //
    // Ejemplo:
    //
    // {
    //   success: false,
    //   message: "Datos inválidos",
    //   errors: [...]
    // }
    //
    // errors.array():
    // convierte errores a arreglo serializable.
    //
    // Beneficios:
    //
    // ✅ mensajes claros frontend
    // ✅ debugging sencillo
    // ✅ validaciones centralizadas
    //
    // ------------------------------------------------------

    return badRequest(
      res,
      'Datos inválidos',
      errors.array()
    );
  }



  // ========================================================
  // CONTINUAR FLUJO
  // ========================================================
  //
  // next()
  //
  // Si no hay errores:
  // continúa al siguiente middleware/controller.
  //
  // ========================================================

  next();
};






// ==========================================================
// EXPORTACIÓN
// ==========================================================
//
// Exporta:
//
// ✅ loginRules
// ✅ validate
//
// Para uso en rutas.
//
// Ejemplo:
//
// const {
//   loginRules,
//   validate
// } = require('./validator');
//
// ==========================================================

module.exports = {
  loginRules,
  validate,
};






// ==========================================================
// EJEMPLO DE USO EN RUTAS
// ==========================================================
//
// const express = require('express');
//
// const {
//   loginRules,
//   validate
// } = require('./validator');
//
// router.post(
//   '/login',
//   loginRules,
//   validate,
//   loginController
// );
//
// ==========================================================





// ==========================================================
// EJEMPLO REQUEST VÁLIDO
// ==========================================================
//
// POST /auth/login
//
// {
//   "username": "admin_user",
//   "password": "123456"
// }
//
// ==========================================================





// ==========================================================
// EJEMPLO RESPONSE ERROR
// ==========================================================
//
// {
//   "success": false,
//   "message": "Datos inválidos",
//   "errors": [
//     {
//       "msg": "Usuario requerido",
//       "path": "username"
//     }
//   ]
// }
//
// ==========================================================





// ==========================================================
// BENEFICIOS DE ESTA IMPLEMENTACIÓN
// ==========================================================
//
// ✅ Validaciones centralizadas
// ✅ Sanitización automática
// ✅ Protección básica XSS
// ✅ Código reutilizable
// ✅ Errores consistentes
// ✅ Mejor seguridad
// ✅ Mejor mantenimiento
// ✅ API más robusta
//
// Validar datos temprano salva muchísimo dolor.
// Especialmente cuando usuarios y atacantes
// compiten activamente por romper formularios.
//
// ==========================================================