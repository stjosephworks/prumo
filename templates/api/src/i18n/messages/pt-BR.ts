// What the API says to a person in Brazilian Portuguese: the errors it answers with, and the mail and texts it sends.
export const ptBR = {
  errors: {
    unexpected: 'Ocorreu um erro inesperado.',
    validationFailed: 'Falha na validação',
    unrecognizedKey: 'Campo não reconhecido',
    invalidValue: 'Valor inválido',
    profileNotFound: 'Perfil não encontrado',
    emailTaken: 'Já existe uma conta com este e-mail',
    invalidSession: 'A sessão expirou ou foi encerrada',
    supersededToken: 'O token de atualização acabou de ser trocado; tente de novo com o atual',
    reauthenticationRequired: 'Entre de novo para fazer isso',
    invalidCredentials: 'E-mail ou senha inválidos', // prumo:password
    emailNotVerified: 'Confirme seu e-mail antes de entrar', // prumo:email
    // prumo:codes
    invalidCode: 'O código está errado ou expirou',
    tooManyCodes: 'Um código foi enviado para este endereço há pouco',
    // prumo:end-codes
    // prumo:phone-code
    invalidPhone: 'Digite um número de celular com o código do país, como +55 11 91234 5678',
    phoneNotServed: 'Não enviamos SMS para números desse país',
    // prumo:end-phone-code
    // prumo:social
    socialSignInFailed: 'O login não foi concluído. Comece de novo.',
    signInStartedElsewhere: 'O login foi iniciado em outro navegador. Comece de novo.',
    providerNotConfigured:
      'O login com {provider} não está configurado: defina as variáveis dele no .env',
    providerNotConfiguredInApp: 'O login com {provider} no app não está configurado',
    providerEmailUnverified: 'O provedor não verificou este endereço de e-mail',
    providerSharedNoEmail: 'O provedor não compartilhou um endereço de e-mail',
    // prumo:end-social
    // prumo:apple
    providerConfirmationRequired: 'Confirme com {provider} para excluir esta conta',
    notTheAccountBeingDeleted: 'Essa não é a conta que está sendo excluída. Nada foi excluído.',
    deletionLinkExpired: 'Este link para excluir a conta expirou. Comece de novo.',
    deletionConfirmationExpired: 'Esta confirmação expirou. Comece de novo.',
    // prumo:end-apple
  },
  // prumo:mcp
  // How the consent page words each scope an MCP client asks for.
  scopes: {
    'profile:read': 'Ler o seu perfil',
    'profile:write': 'Alterar o seu nome de exibição, idioma e fuso horário',
  },
  // prumo:end-mcp
  // prumo:mail
  mail: {
    // prumo:email
    verifyEmail: {
      subject: '{code} é o seu código de verificação',
      text: 'Digite {code} para confirmar este endereço de e-mail. O código expira em 15 minutos.',
    },
    resetPassword: {
      subject: '{code} é o seu código para redefinir a senha',
      text: 'Digite {code} para escolher uma nova senha. O código expira em 15 minutos. Se você não pediu, ignore este e-mail: sua senha continua a mesma.',
    },
    // prumo:end-email
    // prumo:email-code
    signIn: {
      subject: '{code} é o seu código de acesso',
      text: 'Digite {code} para entrar. O código expira em 15 minutos. Se você não pediu, ignore este e-mail: ninguém entra sem ele.',
    },
    // prumo:end-email-code
    changeEmail: {
      subject: '{code} é o seu código para trocar o e-mail',
      text: 'Digite {code} para tornar este o e-mail da sua conta. O código expira em 15 minutos. Se você não pediu, ignore este e-mail: nada muda sem ele.',
    },
    emailChanged: {
      subject: 'O e-mail da sua conta foi alterado',
      text: 'Este endereço não é mais o e-mail da sua conta. Se não foi você que alterou, outra pessoa pode estar usando a sua conta: fale com quem administra este serviço.',
    },
  },
  // prumo:end-mail
  // prumo:sms
  // Accents make a text UCS-2, where one part holds 70 characters: each fits one, so none is billed twice.
  texts: {
    signIn: '{code} é seu código de acesso. Vale por 15 minutos. Não compartilhe.',
    changePhone: '{code}: código para trocar o telefone. Vale 15 min. Não compartilhe.',
    phoneChanged: 'Este número saiu da sua conta. Se não foi você, fale com o suporte.',
  },
  // prumo:end-sms
}
