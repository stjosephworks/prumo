import { useLocalSearchParams, useRouter } from 'expo-router'
import { Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ResetPasswordForm } from '@/features/auth/reset-password-form'
import { useClients } from '@/features/clients/clients-context'
import { useMessages } from '@/i18n/i18n'

export default function ResetPasswordScreen() {
  const messages = useMessages()
  const { auth } = useClients()
  const router = useRouter()
  const { email } = useLocalSearchParams<{ email: string }>()

  return (
    <SafeAreaView className="flex-1 justify-center gap-6 p-6">
      <Text className="text-2xl font-semibold text-neutral-900">
        {messages.auth.resetPassword.title}
      </Text>
      <ResetPasswordForm auth={auth} email={email} onReset={() => router.replace('/')} />
    </SafeAreaView>
  )
}
