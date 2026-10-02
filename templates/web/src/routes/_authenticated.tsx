import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { sessionQuery } from '@/api-contract'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery(context.auth))

    if (session === null) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    }

    return { session }
  },
  component: Outlet,
})
