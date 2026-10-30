import type { ConfigContext, ExpoConfig } from 'expo/config'

const REQUIRED = ['EXPO_PUBLIC_API_URL'] as const

// The languages iOS and Android 13+ offer for this app in their own settings: the project's, as src/i18n/locales.ts
// lists them.
const SUPPORTED_LOCALES = [
  'en', // prumo:en
  'pt-BR', // prumo:pt-BR
  'es-419', // prumo:es-419
]

// prumo:google
// Google's own sheet needs the app registered with Google, and its iOS client's id, reversed, as a URL scheme of the
// app. Until both ids are set, the plugin stays out and Google signs in through the browser.
function googleSignIn(): [string, { iosUrlScheme: string }][] {
  const ios = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID

  if (!ios || !process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
    return []
  }

  return [
    [
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: ios.split('.').reverse().join('.') },
    ],
  ]
}

// prumo:end-google
export default ({ config }: ConfigContext): ExpoConfig => {
  const missing = REQUIRED.filter((name) => !process.env[name])

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`)
  }

  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      ['expo-localization', { supportedLocales: SUPPORTED_LOCALES }],
      // prumo:apple
      // Sign in with Apple, as an entitlement of the iOS app.
      'expo-apple-authentication',
      // prumo:end-apple
      ...googleSignIn(), // prumo:google
    ],
  } as ExpoConfig
}
