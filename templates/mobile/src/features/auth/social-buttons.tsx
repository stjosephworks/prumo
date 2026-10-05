import { useQueryClient } from '@tanstack/react-query'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { type AuthClient, type SocialProvider, sessionQuery } from '@/api-contract'
import { Button } from '@/components/ui/button'

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

// The system browser signs in at the provider and comes back to this app's scheme with a one-time code; the code,
// not a token, is what travels in the URL, and the app trades it for its tokens.
export function SocialButtons({
  auth,
  onSignedIn,
}: {
  auth: Pick<AuthClient, 'socialSignInUrl' | 'exchangeSocialCode' | 'getSession'>
  onSignedIn: () => void
}) {
  const queryClient = useQueryClient()
  const [failed, setFailed] = useState(false)

  async function signInWith(provider: SocialProvider) {
    setFailed(false)

    const result = await WebBrowser.openAuthSessionAsync(
      auth.socialSignInUrl(provider, 'mobile'),
      Linking.createURL('social'),
    )

    // Closing the browser is a decision, not a failure.
    if (result.type !== 'success') {
      return
    }

    const code = codeFrom(result.url)

    try {
      if (code === undefined) {
        throw new Error('The provider sign-in came back without a code')
      }

      await auth.exchangeSocialCode(code)
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
