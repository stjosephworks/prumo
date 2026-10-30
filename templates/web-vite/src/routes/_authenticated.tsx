import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { sessionQuery } from '@/api-contract'
import { useAccountLanguage } from '@/features/i18n/account-language'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery(context.auth))

    if (session === null) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    }

    return { session }
  },
  component: SignedIn,
})

function SignedIn() {
  const { api } = Route.useRouteContext()

  useAccountLanguage(api)

  return <Outlet />
}
