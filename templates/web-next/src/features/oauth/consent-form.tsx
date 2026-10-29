'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { ApiError, type AuthClient } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { useClients } from '@/features/clients/clients'
import { rich, useMessages } from '@/i18n/i18n'

type AuthorizationView = {
  clientId: string
  clientName: string
  clientHost: string
  redirectHost: string
  redirectsToThisDevice: boolean
  scopes: { scope: string; description: string }[]
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
  const messages = useMessages()
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
        {messages.consent.expired}
      </p>
    )
  }

  const { clientName, clientHost, redirectHost, redirectsToThisDevice, scopes } = view.data

  return (
    <div className="flex flex-col gap-6">
      <p>
        {rich(messages.consent.wants, { client: <strong>{clientName}</strong>, host: clientHost })}
      </p>
      <ul aria-label={messages.consent.abilities} className="list-disc pl-6 text-sm">
        {scopes.map(({ scope, description }) => (
          <li key={scope}>{description}</li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        {rich(messages.consent.sentTo, { host: <strong>{redirectHost}</strong> })}
      </p>
      {redirectsToThisDevice && (
        <p role="note" className="text-sm text-destructive">
          {messages.consent.device}
        </p>
      )}
      {answer.isError && (
        <p role="alert" className="text-sm text-destructive">
          {messages.consent.failed}
        </p>
      )}
      <div className="flex gap-3">
        <Button onClick={() => answer.mutate(true)} disabled={answer.isPending}>
          {messages.consent.allow}
        </Button>
        <Button variant="outline" onClick={() => answer.mutate(false)} disabled={answer.isPending}>
          {messages.consent.deny}
        </Button>
      </div>
    </div>
  )
}

// The API sends the browser here with the id of the authorization an MCP client asked for. Signing in first, when
// needed, comes back to this same address.
export function Consent() {
  const { auth } = useClients()
  const request = useSearchParams().get('request') ?? ''

  return (
    <ConsentForm auth={auth} requestId={request} leave={(url) => window.location.assign(url)} />
  )
}
