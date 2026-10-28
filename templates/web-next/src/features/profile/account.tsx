'use client'

import { useQuery } from '@tanstack/react-query'
import { profileQuery } from '@/api-contract'
import { SignOutButton } from '@/features/auth/sign-out-button'
import { useClients } from '@/features/clients/clients'
import { ContactForm } from '@/features/profile/contact-form' // prumo:contact
import { DeleteAccount } from '@/features/profile/delete-account'
import { ProfileForm } from '@/features/profile/profile-form'

export function Account() {
  const { api, auth } = useClients()
  const profile = useQuery(profileQuery(api))

  if (profile.data === undefined) {
    return profile.isError ? (
      <p role="alert" className="text-sm text-destructive">
        Your profile could not be loaded.
      </p>
    ) : null
  }

  return (
    <>
      <ProfileForm api={api} profile={profile.data} />
      {/* prumo:contact */}
      <ContactForm api={api} auth={auth} />
      {/* prumo:end-contact */}
      <SignOutButton auth={auth} />
      <DeleteAccount auth={auth} />
    </>
  )
}
