'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect } from 'react'
import { sessionQuery } from '@/api-contract'
import { useClients } from '@/features/clients/clients'
import { useAccountLanguage } from '@/features/i18n/account-language'
import { useLocalePath } from '@/i18n/i18n'

// The signed-in area runs in the browser, where the API's cookies are: the server that rendered the page never knows
// who is signed in. Nothing inside renders until the session is known, and a visitor without one is sent to sign in,
// to come back to this same address afterwards.
export function SignedIn({ children }: { children: ReactNode }) {
  const { api, auth } = useClients() // prumo:multi-language
  // prumo:single-language
  // const { auth } = useClients()
  // prumo:end-single-language
  const router = useRouter()
  const localePath = useLocalePath()
  const session = useQuery(sessionQuery(auth))

  useAccountLanguage(api)

  useEffect(() => {
    if (session.data === null) {
      const redirect = `${window.location.pathname}${window.location.search}`

      router.replace(`${localePath('/sign-in')}?${new URLSearchParams({ redirect })}`)
    }
  }, [session.data, router, localePath])

  return session.data ? children : null
}
