import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { profileQuery } from '@/api-contract'
import { SignOutButton } from '@/features/auth/sign-out-button'
import { useClients } from '@/features/clients/clients-context'
import { LanguageSwitcher } from '@/features/i18n/language-switcher'
import { ContactForm } from '@/features/profile/contact-form' // prumo:contact
import { DeleteAccount } from '@/features/profile/delete-account'
import { ProfileForm } from '@/features/profile/profile-form'
import { useMessages } from '@/i18n/i18n'

export default function ProfileScreen() {
  const messages = useMessages()
  const { api, auth } = useClients()
  const router = useRouter()
  const profile = useQuery(profileQuery(api))

  return (
    <SafeAreaView className="flex-1 justify-center gap-6 p-6">
      <Text className="text-2xl font-semibold text-neutral-900">{messages.profile.title}</Text>
      {profile.data === undefined ? null : <ProfileForm api={api} profile={profile.data} />}
      <LanguageSwitcher />
      {/* prumo:contact */}
      <ContactForm api={api} auth={auth} onSignedOut={() => router.replace('/sign-in')} />
      {/* prumo:end-contact */}
      <SignOutButton auth={auth} onSignedOut={() => router.replace('/sign-in')} />
      <DeleteAccount auth={auth} onSignedOut={() => router.replace('/sign-in')} />
    </SafeAreaView>
  )
}
