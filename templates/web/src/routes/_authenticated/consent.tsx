import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ConsentForm } from '@/features/oauth/consent-form'

// Loose, because every parameter Better Auth signed has to stay in the URL for the consent request.
export const Route = createFileRoute('/_authenticated/consent')({
  validateSearch: z.looseObject({ client_id: z.string(), scope: z.string().default('') }),
  component: ConsentPage,
})

function ConsentPage() {
  const { auth } = Route.useRouteContext()
  const { client_id, scope } = Route.useSearch()

  return (
    <>
      <h1 className="text-2xl font-semibold">Allow access</h1>
      <ConsentForm auth={auth} clientId={client_id} scopes={scope.split(' ').filter(Boolean)} />
    </>
  )
}
