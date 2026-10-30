// What the app says in English.
export const en = {
  language: 'Language',
  // The choice that leaves the language to the phone's settings, which iOS and Android 13+ set per app.
  followSystem: 'Follow the system',
  forms: {
    tryAgainIn: 'Try again in {seconds} seconds.',
    signInAgain: 'Sign in again',
    // prumo:codes
    code: 'Code',
    sixDigits: 'Enter the 6 digits we sent',
    sendNewCode: 'Send a new code',
    sendNewCodeIn: 'Send a new code in {seconds}s',
    newCodeSent: 'A new code is on its way. The previous one no longer works.',
    // prumo:end-codes
    cancel: 'Cancel', // prumo:contact
  },
  auth: {
    email: 'Email',
    signIn: {
      title: 'Sign in',
      submit: 'Sign in',
      withPassword: 'Sign in with a password',
      withCode: 'Sign in with a code instead',
      // prumo:password
      password: 'Password',
      noAccount: 'No account?',
      signUp: 'Sign up',
      forgot: 'Forgot your password?', // prumo:email
      // prumo:end-password
    },
    // prumo:password
    signUp: {
      title: 'Create an account',
      name: 'Name',
      submit: 'Create account',
      registered: 'Already registered?',
      signIn: 'Sign in',
    },
    // prumo:end-password
    // prumo:code-sign-in
    code: {
      // prumo:email-code
      useEmail: 'Use email instead',
      anotherEmail: 'Use another email',
      // prumo:end-email-code
      // prumo:phone-code
      phone: 'Phone number',
      phoneHint: 'A mobile number, with its country code, as +1 415 555 2671.',
      phoneRequired: 'Enter your mobile number',
      usePhone: 'Use a phone number instead',
      anotherNumber: 'Use another number',
      // prumo:end-phone-code
      send: 'Send me a code',
      createsAccount: 'No account yet? The code creates one.',
      sentTo: 'We sent a 6-digit code to {to}.',
    },
    // prumo:end-code-sign-in
    // prumo:email
    verifyEmail: {
      title: 'Confirm your email',
      sixDigits: 'Enter the 6 digits from the email',
      sentTo: 'We sent a 6-digit code to {email}.',
      submit: 'Confirm email',
    },
    forgotPassword: {
      title: 'Reset your password',
      submit: 'Send a reset code',
    },
    resetPassword: {
      title: 'Choose a new password',
      sentTo: 'If {email} has an account, a 6-digit code is on its way to it.',
      password: 'New password',
      submit: 'Set the new password',
    },
    // prumo:end-email
    // prumo:social
    social: {
      failed: 'The sign-in did not complete. Try again.',
      emailUnverified: 'That account’s email is not verified with the provider.',
      notConfigured: 'That sign-in is not set up yet.',
      google: 'Continue with Google', // prumo:google
      // prumo:apple
      apple: 'Continue with Apple',
      deleted: 'Your account was deleted.',
      // prumo:end-apple
    },
    // prumo:end-social
    signOut: 'Sign out',
  },
  profile: {
    title: 'Your profile',
    displayName: 'Display name',
    timezone: 'Timezone',
    save: 'Save',
    // prumo:contact
    contact: {
      title: 'How you sign in',
      current: '{channel}: {address}',
      none: 'none yet',
      send: 'Send a code there',
      sentTo: 'If {to} is free, a 6-digit code is on its way there.',
      confirm: 'Confirm',
      stale: 'To change how you sign in, sign in again first.',
      // prumo:mail
      email: 'Email',
      addEmail: 'Add an email',
      changeEmail: 'Change your email',
      newEmail: 'New email',
      // prumo:end-mail
      // prumo:sms
      phone: 'Phone number',
      addPhone: 'Add a phone number',
      changePhone: 'Change your phone number',
      newPhone: 'New phone number',
      // prumo:end-sms
    },
    // prumo:end-contact
    deletion: {
      delete: 'Delete account',
      warning: 'This deletes your account and everything in it. It cannot be undone.',
      failed: 'Your account could not be deleted. Try again.',
      confirm: 'Delete my account',
      keep: 'Keep my account',
      stale: 'To delete your account, sign in again first.',
      // prumo:apple
      apple: 'Your account signs in with Apple. Confirm with Apple to delete it.',
      continueWithApple: 'Continue with Apple',
      // prumo:end-apple
    },
  },
}
