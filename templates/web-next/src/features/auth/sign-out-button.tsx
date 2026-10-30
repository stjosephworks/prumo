'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import type { AuthClient } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { useLocalePath, useMessages } from '@/i18n/i18n'

export function SignOutButton({ auth }: { auth: Pick<AuthClient, 'signOut'> }) {
  const messages = useMessages()
  const localePath = useLocalePath()
  const queryClient = useQueryClient()
  const router = useRouter()

  async function signOut() {
    try {
      await auth.signOut()
    } catch {
      // The request may never arrive. The cache is cleared regardless, because data left behind for the next person
      // on this tab is the worse error; the cookies then survive until the access token expires and the refresh fails.
    }

    // The whole cache, not only the session: a query about "me" belongs to whoever was signed in.
    queryClient.clear()
    router.push(localePath('/sign-in'))
  }

  return (
    <Button type="button" variant="outline" onClick={signOut}>
      {messages.auth.signOut}
    </Button>
  )
}
