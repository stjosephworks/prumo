import { useQueryClient } from '@tanstack/react-query'
import type { AuthClient } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { clearUserData } from '@/features/storage/storage'

export type SignOutAuth = Pick<AuthClient, 'signOut'>

export function SignOutButton({
  auth,
  onSignedOut,
}: {
  auth: SignOutAuth
  onSignedOut: () => void
}) {
  const queryClient = useQueryClient()

  async function signOut() {
    try {
      await auth.signOut()
    } catch {
      // A failed request leaves nothing on the device to act on: the auth client forgets the tokens either way. The
      // server's session outlives them until it expires, and signing out locally is still what was asked.
    }

    // What the auth client cannot know is the rest of this user's data: the query cache and every user-scoped key, or the
    // next person on this device reads them.
    queryClient.clear()
    clearUserData()
    onSignedOut()
  }

  return <Button label="Sign out" variant="outline" onPress={signOut} />
}
