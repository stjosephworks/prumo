import type { AuthClient } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { navigate } from '@/lib/navigate'

export function SignOutButton({ auth }: { auth: Pick<AuthClient, 'signOut'> }) {
  async function signOut() {
    try {
      await auth.signOut()
    } catch {
      // The request may never arrive. The page is left regardless, because data left behind for the next person on
      // this tab is the worse error; the cookies then survive until the access token expires and the refresh fails.
    }

    // A new page load, so nothing of whoever was signed in stays in memory.
    navigate.to('/sign-in')
  }

  return (
    <Button type="button" variant="outline" onClick={signOut}>
      Sign out
    </Button>
  )
}
