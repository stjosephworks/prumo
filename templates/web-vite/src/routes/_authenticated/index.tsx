import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { profileQuery } from '@/api-contract'
import { SignOutButton } from '@/features/auth/sign-out-button'
import { ContactForm } from '@/features/profile/contact-form' // prumo:contact
import { DeleteAccount } from '@/features/profile/delete-account'
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
      {/* prumo:contact */}
      <ContactForm api={api} auth={auth} />
      {/* prumo:end-contact */}
      <SignOutButton auth={auth} />
      <DeleteAccount auth={auth} />
    </>
  )
}
