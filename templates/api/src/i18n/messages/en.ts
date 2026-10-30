// What the API says to a person in English: the errors it answers with, and the mail and texts it sends.
export const en = {
  errors: {
    unexpected: 'An unexpected error occurred.',
    validationFailed: 'Validation failed',
    unrecognizedKey: 'Unrecognized key',
    invalidValue: 'Invalid value',
    profileNotFound: 'Profile not found',
    emailTaken: 'An account with this email already exists',
    invalidSession: 'Session expired or revoked',
    supersededToken: 'Refresh token was just rotated; retry with the current one',
    reauthenticationRequired: 'Sign in again to do this',
    invalidCredentials: 'Invalid email or password', // prumo:password
    emailNotVerified: 'Confirm your email before signing in', // prumo:email
    // prumo:codes
    invalidCode: 'The code is wrong or has expired',
    tooManyCodes: 'A code was sent to this address too recently',
    // prumo:end-codes
    // prumo:phone-code
    invalidPhone: 'Enter a mobile number with its country code, as +1 415 555 2671',
    phoneNotServed: 'Texts are not sent to numbers in that country',
    // prumo:end-phone-code
    // prumo:social
    socialSignInFailed: 'The sign-in did not complete. Start again.',
    signInStartedElsewhere: 'The sign-in was started in another browser. Start again.',
    providerNotConfigured: 'Sign-in with {provider} is not configured: set its variables in .env',
    providerNotConfiguredInApp: 'Sign-in with {provider} in the app is not configured',
    providerEmailUnverified: 'The provider has not verified this email address',
    providerSharedNoEmail: 'The provider did not share an email address',
    // prumo:end-social
    // prumo:apple
    providerConfirmationRequired: 'Confirm with {provider} to delete this account',
    notTheAccountBeingDeleted: 'That is not the account being deleted. Nothing was deleted.',
    deletionLinkExpired: 'This link to delete the account has expired. Start again.',
    deletionConfirmationExpired: 'This confirmation has expired. Start again.',
    // prumo:end-apple
  },
  // prumo:mcp
  // How the consent page words each scope an MCP client asks for.
  scopes: {
    'profile:read': 'Read your profile',
    'profile:write': 'Change your display name, language and timezone', // prumo:multi-language
    // prumo:single-language
    // 'profile:write': 'Change your display name and timezone',
    // prumo:end-single-language
  },
  // prumo:end-mcp
  // prumo:mail
  mail: {
    // prumo:email
    verifyEmail: {
      subject: '{code} is your verification code',
      text: 'Enter {code} to confirm this email address. The code expires in 15 minutes.',
    },
    resetPassword: {
      subject: '{code} is your password reset code',
      text: 'Enter {code} to choose a new password. The code expires in 15 minutes. If you did not ask for it, ignore this email: your password stays as it is.',
    },
    // prumo:end-email
    // prumo:email-code
    signIn: {
      subject: '{code} is your sign-in code',
      text: 'Enter {code} to sign in. The code expires in 15 minutes. If you did not ask for it, ignore this email: nobody can sign in without it.',
    },
    // prumo:end-email-code
    changeEmail: {
      subject: '{code} is your code to change your email',
      text: 'Enter {code} to make this the email of your account. The code expires in 15 minutes. If you did not ask for it, ignore this email: nothing changes without it.',
    },
    emailChanged: {
      subject: 'The email of your account was changed',
      text: 'This address is no longer the email of your account. If you did not change it, someone else may be signed in to your account: contact the people who run this service.',
    },
  },
  // prumo:end-mail
  // prumo:sms
  texts: {
    signIn: '{code} is your sign-in code. It expires in 15 minutes. Never share it.',
    changePhone:
      '{code} is your code to make this the phone of your account. It expires in 15 minutes. Never share it.',
    phoneChanged:
      'This number is no longer the phone of your account. If you did not change it, contact the people who run this service.',
  },
  // prumo:end-sms
}
