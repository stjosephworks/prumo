import { useRouter } from 'expo-router'
import { Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CodeSignInForm } from '@/features/auth/code-sign-in-form' // prumo:email-code
import { takeIntendedRoute } from '@/features/auth/intended-route'
import { SignInChoice } from '@/features/auth/sign-in-choice'
import { SignInForm } from '@/features/auth/sign-in-form' // prumo:password
import { SocialButtons } from '@/features/auth/social-buttons' // prumo:social
import { useClients } from '@/features/clients/clients-context'

export default function SignInScreen() {
  const { auth } = useClients()
  const router = useRouter()
  const signedIn = () => router.replace(takeIntendedRoute() ?? '/')

  return (
    <SafeAreaView className="flex-1 justify-center gap-6 p-6">
      <Text className="text-2xl font-semibold text-neutral-900">Sign in</Text>
      {/* prumo:social */}
      <SocialButtons auth={auth} onSignedIn={signedIn} />
      {/* prumo:end-social */}
      <SignInChoice
        code={<CodeSignInForm auth={auth} onSignedIn={signedIn} />} // prumo:email-code
        password={<SignInForm auth={auth} onSignedIn={signedIn} />} // prumo:password
      />
    </SafeAreaView>
  )
}
