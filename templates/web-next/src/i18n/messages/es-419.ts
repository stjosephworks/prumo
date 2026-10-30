// What the app says in Latin American Spanish.
export const es419 = {
  language: 'Idioma',
  home: {
    title: 'Inicio',
    // What a search result says about the app: one sentence of your own, in every language.
    description:
      'Reemplaza esto por una frase que le diga a un resultado de búsqueda qué es esta app.',
    body: 'Esta página se genera una vez, al compilar, y se sirve como HTML estático. Todo lo que está detrás del inicio de sesión corre en el navegador.',
    signIn: 'Iniciar sesión',
  },
  forms: {
    tryAgainIn: 'Vuelve a intentarlo en {seconds} segundos.',
    signInAgain: 'Volver a iniciar sesión',
    // prumo:codes
    code: 'Código',
    sixDigits: 'Ingresa los 6 dígitos que enviamos',
    sendNewCode: 'Enviar un código nuevo',
    sendNewCodeIn: 'Enviar un código nuevo en {seconds} s',
    newCodeSent: 'Un código nuevo va en camino. El anterior ya no sirve.',
    // prumo:end-codes
    cancel: 'Cancelar', // prumo:contact
  },
  auth: {
    email: 'Correo electrónico',
    signIn: {
      title: 'Iniciar sesión',
      submit: 'Iniciar sesión',
      withPassword: 'Iniciar sesión con contraseña',
      withCode: 'Iniciar sesión con un código',
      // prumo:password
      password: 'Contraseña',
      noAccount: '¿No tienes cuenta?',
      signUp: 'Regístrate',
      forgot: '¿Olvidaste tu contraseña?', // prumo:email
      // prumo:end-password
    },
    // prumo:password
    signUp: {
      title: 'Crear una cuenta',
      name: 'Nombre',
      submit: 'Crear cuenta',
      registered: '¿Ya tienes cuenta?',
      signIn: 'Inicia sesión',
    },
    // prumo:end-password
    // prumo:code-sign-in
    code: {
      // prumo:email-code
      useEmail: 'Usar correo electrónico',
      anotherEmail: 'Usar otro correo',
      // prumo:end-email-code
      // prumo:phone-code
      phone: 'Número de celular',
      phoneHint: 'Un número de celular, con su código de país, como +52 55 1234 5678.',
      phoneRequired: 'Ingresa tu número de celular',
      usePhone: 'Usar un número de celular',
      anotherNumber: 'Usar otro número',
      // prumo:end-phone-code
      send: 'Envíame un código',
      createsAccount: '¿Todavía no tienes cuenta? El código crea una.',
      sentTo: 'Enviamos un código de 6 dígitos a {to}.',
    },
    // prumo:end-code-sign-in
    // prumo:email
    verifyEmail: {
      title: 'Confirma tu correo electrónico',
      sixDigits: 'Ingresa los 6 dígitos del correo',
      sentTo: 'Enviamos un código de 6 dígitos a {email}.',
      submit: 'Confirmar correo',
    },
    forgotPassword: {
      title: 'Restablece tu contraseña',
      submit: 'Enviar un código para restablecerla',
    },
    resetPassword: {
      title: 'Elige una contraseña nueva',
      sentTo: 'Si {email} tiene una cuenta, un código de 6 dígitos va en camino.',
      password: 'Contraseña nueva',
      submit: 'Guardar la contraseña nueva',
    },
    // prumo:end-email
    // prumo:social
    social: {
      failed: 'No se completó el inicio de sesión. Vuelve a intentarlo.',
      emailUnverified: 'El correo de esa cuenta no está verificado con el proveedor.',
      notConfigured: 'Ese inicio de sesión todavía no está configurado.',
      google: 'Continuar con Google', // prumo:google
      // prumo:apple
      apple: 'Continuar con Apple',
      deleted: 'Se eliminó tu cuenta.',
      // prumo:end-apple
    },
    // prumo:end-social
    signOut: 'Cerrar sesión',
  },
  profile: {
    title: 'Tu perfil',
    loadFailed: 'No se pudo cargar tu perfil.',
    displayName: 'Nombre visible',
    timezone: 'Zona horaria',
    save: 'Guardar',
    // prumo:contact
    contact: {
      title: 'Cómo inicias sesión',
      current: '{channel}: {address}',
      none: 'ninguno todavía',
      send: 'Enviar un código ahí',
      sentTo: 'Si {to} está libre, un código de 6 dígitos va en camino.',
      confirm: 'Confirmar',
      stale: 'Para cambiar cómo inicias sesión, primero vuelve a iniciar sesión.',
      // prumo:mail
      email: 'Correo electrónico',
      addEmail: 'Agregar un correo electrónico',
      changeEmail: 'Cambiar tu correo electrónico',
      newEmail: 'Correo electrónico nuevo',
      // prumo:end-mail
      // prumo:sms
      phone: 'Número de celular',
      addPhone: 'Agregar un número de celular',
      changePhone: 'Cambiar tu número de celular',
      newPhone: 'Número de celular nuevo',
      // prumo:end-sms
    },
    // prumo:end-contact
    deletion: {
      delete: 'Eliminar cuenta',
      warning: 'Esto elimina tu cuenta y todo lo que contiene. No se puede deshacer.',
      failed: 'No se pudo eliminar tu cuenta. Vuelve a intentarlo.',
      confirm: 'Eliminar mi cuenta',
      keep: 'Conservar mi cuenta',
      stale: 'Para eliminar tu cuenta, primero vuelve a iniciar sesión.',
      // prumo:apple
      apple: 'Tu cuenta inicia sesión con Apple. Confirma con Apple para eliminarla.',
      continueWithApple: 'Continuar con Apple',
      // prumo:end-apple
    },
  },
  // prumo:mcp
  consent: {
    title: 'Permitir acceso',
    expired: 'Esta solicitud venció o ya se respondió. Vuelve a empezar desde la aplicación.',
    wants: '{client} ({host}) quiere actuar en tu nombre.',
    abilities: 'Lo que podrá hacer',
    sentTo: 'Si lo permites, irás a {host}.',
    device:
      'Vuelve a un programa en este dispositivo. Permítelo solo si empezaste esto desde un programa de confianza.',
    failed: 'No se pudo completar la autorización. Vuelve a empezar desde la aplicación.',
    allow: 'Permitir',
    deny: 'Denegar',
  },
  // prumo:end-mcp
}
