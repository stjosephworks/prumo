import { useQuery } from '@tanstack/react-query'
import { Redirect, Stack, usePathname } from 'expo-router'
import { sessionQuery } from '@/api-contract'
import { rememberIntendedRoute } from '@/features/auth/intended-route'
import { useClients } from '@/features/clients/clients-context'
import { useAccountLanguage } from '@/features/i18n/account-language'

export default function AuthenticatedLayout() {
  const { auth } = useClients()
  const session = useQuery(sessionQuery(auth))
  const pathname = usePathname()

  // Pending is not signed out: after the cache is cleared, the session takes a request to arrive, and redirecting on
  // that would send whoever just signed in straight back to sign in. A failed request still redirects.
  if (session.isPending) {
    return null
  }

  if (session.data === null || session.data === undefined) {
    rememberIntendedRoute(pathname)
    return <Redirect href="/sign-in" />
  }

  return <SignedIn /> // prumo:multi-language
  // prumo:single-language
  // return <Stack screenOptions={{ headerShown: false }} />
  // prumo:end-single-language
}

// prumo:multi-language
// Only once signed in does the account have a language for the app to follow, or to take the app's.
function SignedIn() {
  const { api } = useClients()

  useAccountLanguage(api)

  return <Stack screenOptions={{ headerShown: false }} />
}
// prumo:end-multi-language
