import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useEffect } from 'react'
import { sessionQuery } from '@/api-contract'
import { useClients } from '@/features/clients/clients'
import { navigate } from '@/lib/navigate'

// The signed-in area runs in the browser, where the API's cookies are: the server that rendered the page never knows
// who is signed in. Nothing inside renders until the session is known, and a visitor without one is sent to sign in,
// to come back to this same address afterwards.
export function SignedIn({ children }: { children: ReactNode }) {
  const { auth } = useClients()
  const session = useQuery(sessionQuery(auth))

  useEffect(() => {
    if (session.data === null) {
      const redirect = `${window.location.pathname}${window.location.search}`

      navigate.replace(`/sign-in?${new URLSearchParams({ redirect })}`)
    }
  }, [session.data])

  return session.data ? children : null
}
