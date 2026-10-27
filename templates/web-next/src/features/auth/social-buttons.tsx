'use client'

import { useSearchParams } from 'next/navigation'
import type { AuthClient } from '@/api-contract'
import { buttonVariants } from '@/components/ui/button'
import { useClients } from '@/features/clients/clients'

// What the API sends back to sign-in when a provider sign-in does not complete.
const FAILURES: Record<string, string> = {
  provider_email_unverified: 'That account’s email is not verified with the provider.',
  provider_not_configured: 'That sign-in is not set up yet.',
}

// Plain links: the browser leaves for the provider and comes back signed in, with no script holding a token.
export function SocialButtons({
  auth,
  returnTo,
  error,
}: {
  auth: Pick<AuthClient, 'socialSignInUrl'>
  returnTo: string | undefined
  error: string | undefined
}) {
  return (
    <div className="flex flex-col gap-3">
      {error !== undefined && (
        <p role="alert" className="text-sm text-destructive">
          {FAILURES[error] ?? 'The sign-in did not complete. Try again.'}
        </p>
      )}
      {/* prumo:google */}
      <a
        href={auth.socialSignInUrl('google', 'web', returnTo, window.location.origin)}
        className={buttonVariants({ variant: 'outline' })}
      >
        Continue with Google
      </a>
      {/* prumo:end-google */}
      {/* prumo:apple */}
      <a
        href={auth.socialSignInUrl('apple', 'web', returnTo, window.location.origin)}
        className={buttonVariants({ variant: 'outline' })}
      >
        Continue with Apple
      </a>
      {/* prumo:end-apple */}
    </div>
  )
}

// The buttons the sign-in page renders, coming back where the visitor was going, or with why the last try failed.
export function SocialSignIn() {
  const { auth } = useClients()
  const search = useSearchParams()

  return (
    <SocialButtons
      auth={auth}
      returnTo={search.get('redirect') ?? undefined}
      error={search.get('error') ?? undefined}
    />
  )
}
