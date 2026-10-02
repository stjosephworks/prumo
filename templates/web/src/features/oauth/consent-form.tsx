import { useMutation, useQuery } from '@tanstack/react-query'
import { ApiError, type AuthClient } from '@/api-contract'
import { Button } from '@/components/ui/button'

type AuthorizationView = {
  clientId: string
  clientName: string
  clientHost: string
  redirectHost: string
  redirectsToThisDevice: boolean
}

type ConsentAuth = Pick<AuthClient, 'baseUrl' | 'fetch'>

async function call<T>(auth: ConsentAuth, path: string, init?: RequestInit): Promise<T> {
  const response = await auth.fetch(`${auth.baseUrl}/api/oauth${path}`, init)

  if (!response.ok) {
    throw await ApiError.fromResponse(response)
  }

  return (await response.json()) as T
}

// What the user agrees to is shown by host, not only by name: a name is whatever the client chose to write.
export function ConsentForm({
  auth,
  requestId,
  leave,
}: {
  auth: ConsentAuth
  requestId: string
  leave: (url: string) => void
}) {
  const view = useQuery({
    queryKey: ['oauth-authorization', requestId],
    queryFn: () => call<AuthorizationView>(auth, `/authorizations/${requestId}`),
    retry: false,
  })
  const answer = useMutation({
    mutationFn: (accept: boolean) =>
      call<{ redirectTo: string }>(auth, `/authorizations/${requestId}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accept }),
      }),
    // The answer goes back to the client either way, as the code or as access_denied.
    onSuccess: ({ redirectTo }) => leave(redirectTo),
  })

  if (view.isPending) {
    return null
  }

  if (view.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        This request has expired or was already answered. Start again from the application.
      </p>
    )
  }

  const { clientName, clientHost, redirectHost, redirectsToThisDevice } = view.data

  return (
    <div className="flex flex-col gap-6">
      <p>
        <strong>{clientName}</strong> ({clientHost}) wants to act on your behalf.
      </p>
      <p className="text-sm text-muted-foreground">
        If you allow it, you will be sent to <strong>{redirectHost}</strong>.
      </p>
      {redirectsToThisDevice && (
        <p role="note" className="text-sm text-destructive">
          It returns to a program on this device. Allow it only if you started this from a program
          you trust.
        </p>
      )}
      {answer.isError && (
        <p role="alert" className="text-sm text-destructive">
          The authorization could not be completed. Start again from the application.
        </p>
      )}
      <div className="flex gap-3">
        <Button onClick={() => answer.mutate(true)} disabled={answer.isPending}>
          Allow
        </Button>
        <Button variant="outline" onClick={() => answer.mutate(false)} disabled={answer.isPending}>
          Deny
        </Button>
      </div>
    </div>
  )
}
