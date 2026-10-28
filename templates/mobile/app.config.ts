import type { ConfigContext, ExpoConfig } from 'expo/config'

const REQUIRED = ['EXPO_PUBLIC_API_URL'] as const

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
    // prumo:social
    plugins: [
      ...(config.plugins ?? []),
      // prumo:apple
      // Sign in with Apple, as an entitlement of the iOS app.
      'expo-apple-authentication',
      // prumo:end-apple
      ...googleSignIn(), // prumo:google
    ],
    // prumo:end-social
  } as ExpoConfig
}
