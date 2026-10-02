import { useLocalSearchParams, useRouter } from 'expo-router'
import { Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { VerifyEmailForm } from '@/features/auth/verify-email-form'
import { useClients } from '@/features/clients/clients-context'

export default function VerifyEmailScreen() {
  const { auth } = useClients()
  const router = useRouter()
  const { email } = useLocalSearchParams<{ email: string }>()

  return (
    <SafeAreaView className="flex-1 justify-center gap-6 p-6">
      <Text className="text-2xl font-semibold text-neutral-900">Confirm your email</Text>
      <VerifyEmailForm auth={auth} email={email} onVerified={() => router.replace('/')} />
    </SafeAreaView>
  )
}
