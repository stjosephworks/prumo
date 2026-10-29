// What the API says to a person in Latin American Spanish: the errors it answers with, and the mail and texts it sends.
export const es419 = {
  errors: {
    unexpected: 'Ocurrió un error inesperado.',
    validationFailed: 'Error de validación',
    unrecognizedKey: 'Campo no reconocido',
    invalidValue: 'Valor no válido',
    profileNotFound: 'No se encontró el perfil',
    emailTaken: 'Ya existe una cuenta con este correo electrónico',
    invalidSession: 'La sesión venció o se cerró',
    supersededToken:
      'El token de actualización se acaba de renovar; vuelve a intentarlo con el actual',
    reauthenticationRequired: 'Vuelve a iniciar sesión para hacer esto',
    invalidCredentials: 'Correo electrónico o contraseña no válidos', // prumo:password
    emailNotVerified: 'Confirma tu correo electrónico antes de iniciar sesión', // prumo:email
    // prumo:codes
    invalidCode: 'El código es incorrecto o venció',
    tooManyCodes: 'Se envió un código a esta dirección hace muy poco',
    // prumo:end-codes
    // prumo:phone-code
    invalidPhone: 'Ingresa un número de celular con el código de país, como +52 55 1234 5678',
    phoneNotServed: 'No enviamos SMS a números de ese país',
    // prumo:end-phone-code
    // prumo:social
    socialSignInFailed: 'No se completó el inicio de sesión. Vuelve a empezar.',
    signInStartedElsewhere: 'El inicio de sesión empezó en otro navegador. Vuelve a empezar.',
    providerNotConfigured:
      'El inicio de sesión con {provider} no está configurado: define sus variables en .env',
    providerNotConfiguredInApp: 'El inicio de sesión con {provider} en la app no está configurado',
    providerEmailUnverified: 'El proveedor no verificó esta dirección de correo electrónico',
    providerSharedNoEmail: 'El proveedor no compartió una dirección de correo electrónico',
    // prumo:end-social
    // prumo:apple
    providerConfirmationRequired: 'Confirma con {provider} para eliminar esta cuenta',
    notTheAccountBeingDeleted: 'Esa no es la cuenta que se está eliminando. No se eliminó nada.',
    deletionLinkExpired: 'Este enlace para eliminar la cuenta venció. Vuelve a empezar.',
    deletionConfirmationExpired: 'Esta confirmación venció. Vuelve a empezar.',
    // prumo:end-apple
  },
  // prumo:mail
  mail: {
    // prumo:email
    verifyEmail: {
      subject: '{code} es tu código de verificación',
      text: 'Ingresa {code} para confirmar esta dirección de correo electrónico. El código vence en 15 minutos.',
    },
    resetPassword: {
      subject: '{code} es tu código para restablecer la contraseña',
      text: 'Ingresa {code} para elegir una contraseña nueva. El código vence en 15 minutos. Si no lo pediste, ignora este correo: tu contraseña sigue igual.',
    },
    // prumo:end-email
    // prumo:email-code
    signIn: {
      subject: '{code} es tu código para iniciar sesión',
      text: 'Ingresa {code} para iniciar sesión. El código vence en 15 minutos. Si no lo pediste, ignora este correo: nadie puede iniciar sesión sin él.',
    },
    // prumo:end-email-code
    changeEmail: {
      subject: '{code} es tu código para cambiar el correo electrónico',
      text: 'Ingresa {code} para que este sea el correo electrónico de tu cuenta. El código vence en 15 minutos. Si no lo pediste, ignora este correo: nada cambia sin él.',
    },
    emailChanged: {
      subject: 'Se cambió el correo electrónico de tu cuenta',
      text: 'Esta dirección ya no es el correo electrónico de tu cuenta. Si no lo cambiaste tú, puede que otra persona haya iniciado sesión en tu cuenta: comunícate con quienes administran este servicio.',
    },
  },
  // prumo:end-mail
  // prumo:sms
  // Accents make a text UCS-2, where one part holds 70 characters: each fits one, so none is billed twice.
  texts: {
    signIn: '{code} es tu código de acceso. Vence en 15 minutos. No lo compartas.',
    changePhone: '{code}: código para cambiar el teléfono. Dura 15 min. No lo compartas.',
    phoneChanged: 'Este número salió de tu cuenta. ¿No fuiste tú? Escribe a soporte.',
  },
  // prumo:end-sms
}
