import { Link, useRouter } from 'expo-router'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SignUpForm } from '@/features/auth/sign-up-form'
import { SocialButtons } from '@/features/auth/social-buttons' // prumo:social
import { useClients } from '@/features/clients/clients-context'

export default function SignUpScreen() {
  const { auth } = useClients()
  const router = useRouter()

  return (
    <SafeAreaView className="flex-1 justify-center gap-6 p-6">
      <Text className="text-2xl font-semibold text-neutral-900">Create an account</Text>
      {/* prumo:social */}
      <SocialButtons auth={auth} onSignedIn={() => router.replace('/')} />
      {/* prumo:end-social */}
      <SignUpForm auth={auth} onSignedUp={() => router.replace('/')} />
      <View className="flex-row gap-1">
        <Text className="text-sm text-neutral-500">Already registered?</Text>
        <Link href="/sign-in" className="text-sm text-neutral-900">
          Sign in
        </Link>
      </View>
    </SafeAreaView>
  )
}
