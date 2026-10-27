import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { profileQuery } from '@/api-contract'
import { SignOutButton } from '@/features/auth/sign-out-button'
import { ProfileForm } from '@/features/profile/profile-form'

export const Route = createFileRoute('/_authenticated/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery(context.api)),
  component: ProfilePage,
})

function ProfilePage() {
  const { api, auth } = Route.useRouteContext()
  const { data: profile } = useSuspenseQuery(profileQuery(api))

  return (
    <>
      <h1 className="text-2xl font-semibold">Your profile</h1>
      <ProfileForm api={api} profile={profile} />
      <SignOutButton auth={auth} />
    </>
  )
}
