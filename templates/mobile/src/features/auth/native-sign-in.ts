import { GoogleSignin } from '@react-native-google-signin/google-signin' // prumo:google
import * as AppleAuthentication from 'expo-apple-authentication' // prumo:apple
import { Platform } from 'react-native' // prumo:apple
import { config } from '@/config' // prumo:google

// The providers' own sign-in sheets, which hand the app an ID token for the API to check instead of a trip through
// the browser. Each answers null when the person closes it.

// prumo:apple
export type AppleConfirmation = { idToken: string; code: string; name: string | null }

// Apple's sheet exists on iOS only; Android goes through the browser.
export const hasAppleSheet = () => Platform.OS === 'ios'

// The API's nonce goes in, and the token that comes out is good for that trip only. The name is asked for at sign-in,
// and Apple gives it the first time only.
export async function appleSheet(
  nonce: string,
  askName: boolean,
): Promise<AppleConfirmation | null> {
  const { EMAIL, FULL_NAME } = AppleAuthentication.AppleAuthenticationScope

  try {
    const credential = await AppleAuthentication.signInAsync({
      nonce,
      requestedScopes: askName ? [FULL_NAME, EMAIL] : [],
    })

    if (credential.identityToken === null || credential.authorizationCode === null) {
      throw new Error('Apple’s sheet gave no token')
    }

    const name = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ')

    return {
      idToken: credential.identityToken,
      code: credential.authorizationCode,
      name: name === '' ? null : name,
    }
  } catch (error) {
    if ((error as { code?: unknown }).code === 'ERR_REQUEST_CANCELED') {
      return null
    }

    throw error
  }
}
// prumo:end-apple

// prumo:google
export const hasGoogleSheet = () =>
  Boolean(config.googleWebClientId) && Boolean(config.googleIosClientId)

// Google issues the token to the web client whose id the app passes, which is the API's own.
export async function googleSheet(): Promise<string | null> {
  GoogleSignin.configure({
    webClientId: config.googleWebClientId,
    iosClientId: config.googleIosClientId,
  })
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })

  const response = await GoogleSignin.signIn()

  if (response.type !== 'success') {
    return null
  }

  // The app keeps its own session, not Google's.
  await GoogleSignin.signOut()

  if (response.data.idToken === null) {
    throw new Error('Google’s sheet gave no token')
  }

  return response.data.idToken
}
// prumo:end-google
