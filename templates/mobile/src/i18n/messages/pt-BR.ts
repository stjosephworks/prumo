// What the app says in Brazilian Portuguese.
export const ptBR = {
  language: 'Idioma',
  // The choice that leaves the language to the phone's settings, which iOS and Android 13+ set per app.
  followSystem: 'Seguir o sistema',
  forms: {
    tryAgainIn: 'Tente de novo em {seconds} segundos.',
    signInAgain: 'Entrar de novo',
    // prumo:codes
    code: 'Código',
    sixDigits: 'Digite os 6 dígitos que enviamos',
    sendNewCode: 'Enviar um novo código',
    sendNewCodeIn: 'Enviar um novo código em {seconds}s',
    newCodeSent: 'Um novo código está a caminho. O anterior não vale mais.',
    // prumo:end-codes
    cancel: 'Cancelar', // prumo:contact
  },
  auth: {
    email: 'E-mail',
    signIn: {
      title: 'Entrar',
      submit: 'Entrar',
      withPassword: 'Entrar com senha',
      withCode: 'Entrar com um código',
      // prumo:password
      password: 'Senha',
      noAccount: 'Não tem conta?',
      signUp: 'Criar conta',
      forgot: 'Esqueceu a senha?', // prumo:email
      // prumo:end-password
    },
    // prumo:password
    signUp: {
      title: 'Criar uma conta',
      name: 'Nome',
      submit: 'Criar conta',
      registered: 'Já tem conta?',
      signIn: 'Entrar',
    },
    // prumo:end-password
    // prumo:code-sign-in
    code: {
      // prumo:email-code
      useEmail: 'Usar e-mail',
      anotherEmail: 'Usar outro e-mail',
      // prumo:end-email-code
      // prumo:phone-code
      phone: 'Celular',
      phoneHint: 'Um número de celular, com o código do país, como +55 11 91234 5678.',
      phoneRequired: 'Digite o seu celular',
      usePhone: 'Usar um celular',
      anotherNumber: 'Usar outro número',
      // prumo:end-phone-code
      send: 'Enviar um código',
      createsAccount: 'Ainda não tem conta? O código cria uma.',
      sentTo: 'Enviamos um código de 6 dígitos para {to}.',
    },
    // prumo:end-code-sign-in
    // prumo:email
    verifyEmail: {
      title: 'Confirme o seu e-mail',
      sixDigits: 'Digite os 6 dígitos do e-mail',
      sentTo: 'Enviamos um código de 6 dígitos para {email}.',
      submit: 'Confirmar e-mail',
    },
    forgotPassword: {
      title: 'Redefina a sua senha',
      submit: 'Enviar um código de redefinição',
    },
    resetPassword: {
      title: 'Escolha uma nova senha',
      sentTo: 'Se {email} tiver uma conta, um código de 6 dígitos está a caminho.',
      password: 'Nova senha',
      submit: 'Definir a nova senha',
    },
    // prumo:end-email
    // prumo:social
    social: {
      failed: 'O login não foi concluído. Tente de novo.',
      emailUnverified: 'O e-mail dessa conta não está verificado no provedor.',
      notConfigured: 'Esse login ainda não está configurado.',
      google: 'Continuar com o Google', // prumo:google
      // prumo:apple
      apple: 'Continuar com a Apple',
      deleted: 'A sua conta foi excluída.',
      // prumo:end-apple
    },
    // prumo:end-social
    signOut: 'Sair',
  },
  profile: {
    title: 'Seu perfil',
    displayName: 'Nome de exibição',
    timezone: 'Fuso horário',
    save: 'Salvar',
    // prumo:contact
    contact: {
      title: 'Como você entra',
      current: '{channel}: {address}',
      none: 'nenhum ainda',
      send: 'Enviar um código para lá',
      sentTo: 'Se {to} estiver livre, um código de 6 dígitos está a caminho.',
      confirm: 'Confirmar',
      stale: 'Para trocar como você entra, entre de novo antes.',
      // prumo:mail
      email: 'E-mail',
      addEmail: 'Adicionar um e-mail',
      changeEmail: 'Trocar o seu e-mail',
      newEmail: 'Novo e-mail',
      // prumo:end-mail
      // prumo:sms
      phone: 'Celular',
      addPhone: 'Adicionar um celular',
      changePhone: 'Trocar o seu celular',
      newPhone: 'Novo celular',
      // prumo:end-sms
    },
    // prumo:end-contact
    deletion: {
      delete: 'Excluir conta',
      warning: 'Isto exclui a sua conta e tudo o que há nela. Não dá para desfazer.',
      failed: 'Não foi possível excluir a sua conta. Tente de novo.',
      confirm: 'Excluir a minha conta',
      keep: 'Manter a minha conta',
      stale: 'Para excluir a sua conta, entre de novo antes.',
      // prumo:apple
      apple: 'A sua conta entra com a Apple. Confirme com a Apple para excluí-la.',
      continueWithApple: 'Continuar com a Apple',
      // prumo:end-apple
    },
  },
}
