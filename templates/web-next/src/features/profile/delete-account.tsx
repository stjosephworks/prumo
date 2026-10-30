'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ApiError, type AuthClient } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { useLocalePath, useMessages } from '@/i18n/i18n'

type Step = 'idle' | 'confirming' | 'stale' | 'apple' | 'failed'

// Deleting the account, which cannot be undone, so it asks twice; a sign-in older than ten minutes is asked again.
export function DeleteAccount({ auth }: { auth: AuthClient }) {
  const messages = useMessages()
  const localePath = useLocalePath()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [step, setStep] = useState<Step>('idle')
  const [deleting, setDeleting] = useState(false)

  async function deleteAccount() {
    setDeleting(true)

    try {
      await auth.deleteAccount()
    } catch (error) {
      setDeleting(false)

      // prumo:apple
      if (error instanceof ApiError && error.code === 'provider_confirmation_required') {
        setStep('apple')
        return
      }

      // prumo:end-apple
      setStep(
        error instanceof ApiError && error.code === 'reauthentication_required'
          ? 'stale'
          : 'failed',
      )
      return
    }

    // Nothing about the person is left to show, here or to the next one on this tab.
    queryClient.clear()
    router.push(localePath('/sign-in'))
  }

  async function signInAgain() {
    await auth.signOut().catch(() => undefined)
    queryClient.clear()
    router.push(
      `${localePath('/sign-in')}?${new URLSearchParams({ redirect: localePath('/account') })}`,
    )
  }

  if (step === 'stale') {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="text-sm text-muted-foreground">
          {messages.profile.deletion.stale}
        </p>
        <Button type="button" onClick={signInAgain}>
          {messages.forms.signInAgain}
        </Button>
      </div>
    )
  }

  // prumo:apple
  // Apple revokes the account's authorization when the person confirms with Apple, and the API then deletes it.
  async function continueWithApple() {
    try {
      window.location.assign(await auth.accountDeletionUrl('web', window.location.origin))
    } catch {
      setStep('failed')
    }
  }

  if (step === 'apple') {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="text-sm text-muted-foreground">
          {messages.profile.deletion.apple}
        </p>
        <Button type="button" variant="destructive" onClick={continueWithApple}>
          {messages.profile.deletion.continueWithApple}
        </Button>
      </div>
    )
  }

  // prumo:end-apple
  if (step === 'idle') {
    return (
      <Button type="button" variant="destructive" onClick={() => setStep('confirming')}>
        {messages.profile.deletion.delete}
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p role="alert" className="text-sm">
        {step === 'failed' ? messages.profile.deletion.failed : messages.profile.deletion.warning}
      </p>
      <Button type="button" variant="destructive" disabled={deleting} onClick={deleteAccount}>
        {messages.profile.deletion.confirm}
      </Button>
      <Button type="button" variant="link" onClick={() => setStep('idle')}>
        {messages.profile.deletion.keep}
      </Button>
    </div>
  )
}
