import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { AuthClient } from '@/features/auth/auth-client'

type PublicClient = { client_name?: string }

// Better Auth checks the signed query on submit; what is shown here comes from the same URL.
export function ConsentForm({
  auth,
  clientId,
  scopes,
}: {
  auth: AuthClient
  clientId: string
  scopes: string[]
}) {
  const [failed, setFailed] = useState(false)
  const client = useQuery({
    queryKey: ['oauth-client', clientId],
    queryFn: async () => {
      const { data } = await auth.$fetch<PublicClient>('/oauth2/public-client', {
        query: { client_id: clientId },
      })

      return data
    },
  })
  const name = client.data?.client_name ?? clientId

  async function answer(accept: boolean) {
    // On success Better Auth sends the browser back to the client, so nothing follows here.
    const { error } = await auth.$fetch('/oauth2/consent', { method: 'POST', body: { accept } })

    setFailed(error !== null)
  }

  return (
    <div className="flex flex-col gap-6">
      <p>
        <strong>{name}</strong> wants to act on your behalf.
      </p>
      {scopes.length > 0 && (
        <ul className="list-disc pl-6 text-sm text-muted-foreground">
          {scopes.map((scope) => (
            <li key={scope}>{scope}</li>
          ))}
        </ul>
      )}
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          The authorization could not be completed. Start again from the application.
        </p>
      )}
      <div className="flex gap-3">
        <Button onClick={() => answer(true)}>Allow</Button>
        <Button variant="outline" onClick={() => answer(false)}>
          Deny
        </Button>
      </div>
    </div>
  )
}
