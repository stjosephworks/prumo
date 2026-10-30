import { useRouter } from 'expo-router'
import { Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form'
import { useClients } from '@/features/clients/clients-context'
import { useMessages } from '@/i18n/i18n'

export default function ForgotPasswordScreen() {
  const messages = useMessages()
  const { auth } = useClients()
  const router = useRouter()

  return (
    <SafeAreaView className="flex-1 justify-center gap-6 p-6">
      <Text className="text-2xl font-semibold text-neutral-900">
        {messages.auth.forgotPassword.title}
      </Text>
      <ForgotPasswordForm
        auth={auth}
        onSent={(email) => router.push({ pathname: '/reset-password', params: { email } })}
      />
    </SafeAreaView>
  )
}
