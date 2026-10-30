'use client'

import { useSearchParams } from 'next/navigation'
import type { AuthClient } from '@/api-contract'
import { buttonVariants } from '@/components/ui/button'
import { useClients } from '@/features/clients/clients'
import { useMessages } from '@/i18n/i18n'
import type { Messages } from '@/i18n/messages'

// What the API sends back to sign-in when a provider sign-in does not complete.
function failureOf(error: string, messages: Messages): string {
  const failures: Record<string, string> = {
    provider_email_unverified: messages.auth.social.emailUnverified,
    provider_not_configured: messages.auth.social.notConfigured,
  }

  return failures[error] ?? messages.auth.social.failed
}

// Plain links: the browser leaves for the provider and comes back signed in, with no script holding a token.
export function SocialButtons({
  auth,
  returnTo,
  error,
  deleted = false, // prumo:apple
}: {
  auth: Pick<AuthClient, 'socialSignInUrl'>
  returnTo: string | undefined
  error: string | undefined
  deleted?: boolean // prumo:apple
}) {
  const messages = useMessages()

  return (
    <div className="flex flex-col gap-3">
      {/* prumo:apple */}
      {deleted && (
        <p role="status" className="text-sm text-muted-foreground">
          {messages.auth.social.deleted}
        </p>
      )}
      {/* prumo:end-apple */}
      {error !== undefined && (
        <p role="alert" className="text-sm text-destructive">
          {failureOf(error, messages)}
        </p>
      )}
      {/* prumo:google */}
      <a
        href={auth.socialSignInUrl('google', 'web', returnTo, window.location.origin)}
        className={buttonVariants({ variant: 'outline' })}
      >
        {messages.auth.social.google}
      </a>
      {/* prumo:end-google */}
      {/* prumo:apple */}
      <a
        href={auth.socialSignInUrl('apple', 'web', returnTo, window.location.origin)}
        className={buttonVariants({ variant: 'outline' })}
      >
        {messages.auth.social.apple}
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
      deleted={search.has('deleted')} // prumo:apple
    />
  )
}
