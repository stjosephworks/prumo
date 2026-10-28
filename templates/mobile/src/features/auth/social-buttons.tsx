import { useQueryClient } from '@tanstack/react-query'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { type AuthClient, type SocialProvider, sessionQuery } from '@/api-contract'
import { Button } from '@/components/ui/button'
import * as sheets from '@/features/auth/native-sign-in'

// Read by hand: the return URL carries one parameter, and parsing it needs nothing from the platform.
function codeFrom(url: string): string | undefined {
  for (const pair of (url.split('?')[1] ?? '').split('&')) {
    const [key, value] = pair.split('=')

    if (key === 'code' && value !== undefined && value !== '') {
      return decodeURIComponent(value)
    }
  }

  return undefined
}

// A provider's own sheet signs in where there is one: Apple's on iOS, and Google's once the app is registered with
// Google. Otherwise the system browser signs in at the provider and comes back to this app's scheme with a one-time
// code; the code, not a token, is what travels in the URL, and the app trades it for its tokens.
export function SocialButtons({ auth, onSignedIn }: { auth: AuthClient; onSignedIn: () => void }) {
  const queryClient = useQueryClient()
  const [failed, setFailed] = useState(false)

  // Signed in, or false when the person closed the sheet or the browser, which is a decision, not a failure.
  async function signIn(provider: SocialProvider): Promise<boolean> {
    // prumo:apple
    if (provider === 'apple' && sheets.hasAppleSheet()) {
      const { trip, nonce } = await auth.appleNonce()
      const apple = await sheets.appleSheet(nonce, true)

      if (apple === null) {
        return false
      }

      await auth.signInWithIdToken('apple', {
        idToken: apple.idToken,
        trip,
        ...(apple.name !== null && { name: apple.name }),
      })
      return true
    }

    // prumo:end-apple
    // prumo:google
    if (provider === 'google' && sheets.hasGoogleSheet()) {
      const idToken = await sheets.googleSheet()

      if (idToken === null) {
        return false
      }

      await auth.signInWithIdToken('google', { idToken })
      return true
    }

    // prumo:end-google
    const result = await WebBrowser.openAuthSessionAsync(
      auth.socialSignInUrl(provider, 'mobile'),
      Linking.createURL('social'),
    )

    if (result.type !== 'success') {
      return false
    }

    const code = codeFrom(result.url)

    if (code === undefined) {
      throw new Error('The provider sign-in came back without a code')
    }

    await auth.exchangeSocialCode(code)
    return true
  }

  async function signInWith(provider: SocialProvider) {
    setFailed(false)

    try {
      if (!(await signIn(provider))) {
        return
      }
    } catch {
      setFailed(true)
      return
    }

    await queryClient.invalidateQueries({ queryKey: sessionQuery(auth).queryKey })
    onSignedIn()
  }

  return (
    <View className="gap-3">
      {failed ? (
        <Text accessibilityRole="alert" className="text-sm text-red-600">
          The sign-in did not complete. Try again.
        </Text>
      ) : null}
      {/* prumo:google */}
      <Button label="Continue with Google" variant="outline" onPress={() => signInWith('google')} />
      {/* prumo:end-google */}
      {/* prumo:apple */}
      <Button label="Continue with Apple" variant="outline" onPress={() => signInWith('apple')} />
      {/* prumo:end-apple */}
    </View>
  )
}
