import { Link, useRouter } from 'expo-router'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { takeIntendedRoute } from '@/features/auth/intended-route'
import { SignInForm } from '@/features/auth/sign-in-form'
import { SocialButtons } from '@/features/auth/social-buttons' // prumo:social
import { useClients } from '@/features/clients/clients-context'

export default function SignInScreen() {
  const { auth } = useClients()
  const router = useRouter()

  return (
    <SafeAreaView className="flex-1 justify-center gap-6 p-6">
      <Text className="text-2xl font-semibold text-neutral-900">Sign in</Text>
      {/* prumo:social */}
      <SocialButtons auth={auth} onSignedIn={() => router.replace(takeIntendedRoute() ?? '/')} />
      {/* prumo:end-social */}
      <SignInForm auth={auth} onSignedIn={() => router.replace(takeIntendedRoute() ?? '/')} />
      <View className="flex-row gap-1">
        <Text className="text-sm text-neutral-500">No account?</Text>
        <Link href="/sign-up" className="text-sm text-neutral-900">
          Sign up
        </Link>
      </View>
      {/* prumo:email */}
      <Link href="/forgot-password" className="text-sm text-neutral-900">
        Forgot your password?
      </Link>
      {/* prumo:end-email */}
    </SafeAreaView>
  )
}
