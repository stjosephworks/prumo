import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiError, type AuthClient } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { navigate } from '@/lib/navigate'

type Step = 'idle' | 'confirming' | 'stale' | 'apple' | 'failed'

// Deleting the account, which cannot be undone, so it asks twice; a sign-in older than ten minutes is asked again.
export function DeleteAccount({ auth }: { auth: AuthClient }) {
  const queryClient = useQueryClient()
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
    navigate.to('/sign-in')
  }

  async function signInAgain() {
    await auth.signOut().catch(() => undefined)
    queryClient.clear()
    navigate.to('/sign-in?redirect=%2Faccount')
  }

  if (step === 'stale') {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="text-sm text-muted-foreground">
          To delete your account, sign in again first.
        </p>
        <Button type="button" onClick={signInAgain}>
          Sign in again
        </Button>
      </div>
    )
  }

  // prumo:apple
  // Apple revokes the account's authorization when the person confirms with Apple, and the API then deletes it.
  async function continueWithApple() {
    try {
      navigate.to(await auth.accountDeletionUrl('web', window.location.origin))
    } catch {
      setStep('failed')
    }
  }

  if (step === 'apple') {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="text-sm text-muted-foreground">
          Your account signs in with Apple. Confirm with Apple to delete it.
        </p>
        <Button type="button" variant="destructive" onClick={continueWithApple}>
          Continue with Apple
        </Button>
      </div>
    )
  }

  // prumo:end-apple
  if (step === 'idle') {
    return (
      <Button type="button" variant="destructive" onClick={() => setStep('confirming')}>
        Delete account
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p role="alert" className="text-sm">
        {step === 'failed'
          ? 'Your account could not be deleted. Try again.'
          : 'This deletes your account and everything in it. It cannot be undone.'}
      </p>
      <Button type="button" variant="destructive" disabled={deleting} onClick={deleteAccount}>
        Delete my account
      </Button>
      <Button type="button" variant="link" onClick={() => setStep('idle')}>
        Keep my account
      </Button>
    </div>
  )
}
