import { useQueryClient } from '@tanstack/react-query'
import * as Linking from 'expo-linking' // prumo:apple
import * as WebBrowser from 'expo-web-browser' // prumo:apple
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ApiError, type AuthClient } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { appleSheet, hasAppleSheet } from '@/features/auth/native-sign-in' // prumo:apple
import { clearUserData } from '@/features/storage/storage'

type Step = 'idle' | 'confirming' | 'stale' | 'apple' | 'failed'

// Deleting the account, which cannot be undone, so it asks twice; a sign-in older than ten minutes is asked again.
// Either way the person ends signed out, and `onSignedOut` takes them to sign in.
export function DeleteAccount({
  auth,
  onSignedOut,
}: {
  auth: AuthClient
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

  // prumo:apple
  // Apple revokes the account's authorization when the person confirms with Apple, and the API then deletes it.
  async function continueWithApple() {
    try {
      if (!(await (hasAppleSheet() ? deleteWithAppleSheet() : deleteThroughBrowser()))) {
        return
      }
    } catch {
      setStep('failed')
      return
    }

    forget()
  }

  // On iOS, Apple's own sheet confirms on a trip bound to this account. False when the person closes it.
  async function deleteWithAppleSheet(): Promise<boolean> {
    const { trip, nonce } = await auth.appleNonce('deletion')
    const apple = await appleSheet(nonce, false)

    if (apple === null) {
      return false
    }

    await auth.deleteAccountWithApple({ trip, idToken: apple.idToken, code: apple.code })
    return true
  }

  // Elsewhere the browser goes to Apple and comes back with `deleted=1`. The tokens left on the device open nothing;
  // signing out drops them. False when the person closes the browser.
  async function deleteThroughBrowser(): Promise<boolean> {
    const result = await WebBrowser.openAuthSessionAsync(
      await auth.accountDeletionUrl('mobile'),
      Linking.createURL('social'),
    )

    if (result.type !== 'success') {
      return false
    }

    if (!(result.url.split('?')[1] ?? '').split('&').includes('deleted=1')) {
      throw new Error('Apple came back without deleting the account')
    }

    await auth.signOut().catch(() => undefined)
    return true
  }

  if (step === 'apple') {
    return (
      <View className="gap-3">
        <Text className="text-sm text-neutral-500">
          Your account signs in with Apple. Confirm with Apple to delete it.
        </Text>
        <Button label="Continue with Apple" onPress={continueWithApple} />
      </View>
    )
  }

  // prumo:end-apple
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
