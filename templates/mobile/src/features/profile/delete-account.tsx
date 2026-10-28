import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ApiError, type AuthClient } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { clearUserData } from '@/features/storage/storage'

type Step = 'idle' | 'confirming' | 'stale' | 'failed'

// Deleting the account, which cannot be undone, so it asks twice; a sign-in older than ten minutes is asked again.
// Either way the person ends signed out, and `onSignedOut` takes them to sign in.
export function DeleteAccount({
  auth,
  onSignedOut,
}: {
  auth: Pick<AuthClient, 'deleteAccount' | 'signOut'>
  onSignedOut: () => void
}) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('idle')
  const [deleting, setDeleting] = useState(false)

  // Nothing about the person is left on the device for the next one.
  function forget() {
    queryClient.clear()
    clearUserData()
    onSignedOut()
  }

  async function deleteAccount() {
    setDeleting(true)

    try {
      await auth.deleteAccount()
    } catch (error) {
      setDeleting(false)
      setStep(
        error instanceof ApiError && error.code === 'reauthentication_required'
          ? 'stale'
          : 'failed',
      )
      return
    }

    forget()
  }

  async function signInAgain() {
    await auth.signOut().catch(() => undefined)
    forget()
  }

  if (step === 'stale') {
    return (
      <View className="gap-3">
        <Text className="text-sm text-neutral-500">
          To delete your account, sign in again first.
        </Text>
        <Button label="Sign in again" onPress={signInAgain} />
      </View>
    )
  }

  if (step === 'idle') {
    return <Button label="Delete account" variant="outline" onPress={() => setStep('confirming')} />
  }

  return (
    <View className="gap-3">
      <Text accessibilityRole="alert" className="text-sm text-neutral-900">
        {step === 'failed'
          ? 'Your account could not be deleted. Try again.'
          : 'This deletes your account and everything in it. It cannot be undone.'}
      </Text>
      <Button label="Delete my account" disabled={deleting} onPress={deleteAccount} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Keep my account"
        onPress={() => setStep('idle')}
      >
        <Text className="text-sm text-neutral-900 underline">Keep my account</Text>
      </Pressable>
    </View>
  )
}
