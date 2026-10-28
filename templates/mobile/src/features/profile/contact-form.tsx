import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Pressable, Text, View } from 'react-native'
import { z } from 'zod'
import {
  type ApiClient,
  ApiError,
  type AuthClient,
  changeEmail, // prumo:mail
  changePhone, // prumo:sms
  requestEmailChange, // prumo:mail
  requestPhoneChange, // prumo:sms
  type Session,
  sessionQuery,
} from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'
import { clearUserData } from '@/features/storage/storage'

type Channel = 'email' | 'phone'

// The addresses this project reaches people at, and so lets them change.
const CHANNELS: Channel[] = [
  'email', // prumo:mail
  'phone', // prumo:sms
]

const NOUN: Record<Channel, string> = { email: 'email', phone: 'phone number' }

function currentOf(user: Session['user'], channel: Channel): string | null {
  // prumo:mail
  if (channel === 'email') {
    return user.email
  }

  // prumo:end-mail
  // prumo:sms
  if (channel === 'phone') {
    return user.phone
  }

  // prumo:end-sms
  return null
}

function requestChange(api: ApiClient, channel: Channel, to: string): Promise<void> {
  // prumo:mail
  if (channel === 'email') {
    return requestEmailChange(api, to)
  }

  // prumo:end-mail
  // prumo:sms
  if (channel === 'phone') {
    return requestPhoneChange(api, to)
  }

  // prumo:end-sms
  throw new Error(`Nothing changes by ${channel}`)
}

async function confirmChange(api: ApiClient, channel: Channel, to: string, code: string) {
  // prumo:mail
  if (channel === 'email') {
    await changeEmail(api, { email: to, code })
    return
  }

  // prumo:end-mail
  // prumo:sms
  if (channel === 'phone') {
    await changePhone(api, { phone: to, code })
    return
  }

  // prumo:end-sms
  throw new Error(`Nothing changes by ${channel}`)
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      <Text className="text-sm text-neutral-900 underline">{label}</Text>
    </Pressable>
  )
}

// How the signed-in person is reached, and so signs in: each address, and a way to change it with a code sent there.
export function ContactForm({
  api,
  auth,
  onSignedOut,
}: {
  api: ApiClient
  auth: AuthClient
  onSignedOut: () => void
}) {
  const { data: session } = useQuery(sessionQuery(auth))
  const [editing, setEditing] = useState<Channel>()

  if (session === undefined || session === null) {
    return null
  }

  return (
    <View className="gap-4">
      <Text className="text-lg font-semibold text-neutral-900">How you sign in</Text>
      {CHANNELS.map((channel) => {
        const current = currentOf(session.user, channel)

        return (
          <View key={channel} className="gap-3">
            <Text className="text-sm text-neutral-900">
              {NOUN[channel][0]?.toUpperCase()}
              {NOUN[channel].slice(1)}: {current ?? 'none yet'}
            </Text>
            {editing === channel ? (
              <ChangeAddress
                api={api}
                auth={auth}
                channel={channel}
                onDone={() => setEditing(undefined)}
                onSignedOut={onSignedOut}
              />
            ) : (
              <Button
                label={current === null ? `Add a ${NOUN[channel]}` : `Change your ${NOUN[channel]}`}
                variant="outline"
                onPress={() => setEditing(channel)}
              />
            )}
          </View>
        )
      })}
    </View>
  )
}

const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6 digits we sent') })

function ChangeAddress({
  api,
  auth,
  channel,
  onDone,
  onSignedOut,
}: {
  api: ApiClient
  auth: AuthClient
  channel: Channel
  onDone: () => void
  onSignedOut: () => void
}) {
  const queryClient = useQueryClient()
  const [to, setTo] = useState<string>()
  const [stale, setStale] = useState(false)
  const addressForm = useForm<{ to: string }>({
    resolver: zodResolver(
      z.object({ to: channel === 'email' ? z.email() : z.string().trim().min(1) }),
    ),
    defaultValues: { to: '' },
  })
  const codeForm = useForm<{ code: string }>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  })

  // A change asks for a sign-in of moments ago; this one is older, so the person signs in again and comes back.
  async function signInAgain() {
    await auth.signOut().catch(() => undefined)
    queryClient.clear()
    clearUserData()
    onSignedOut()
  }

  async function sendCode({ to: address }: { to: string }) {
    try {
      await requestChange(api, channel, address)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'reauthentication_required') {
        setStale(true)
        return
      }

      applyServerError(error, ['to'], addressForm.setError)
      return
    }

    setTo(address)
  }

  async function confirm({ code }: { code: string }) {
    if (to === undefined) {
      return
    }

    try {
      await confirmChange(api, channel, to, code)
    } catch (error) {
      applyServerError(error, ['code'], codeForm.setError)
      return
    }

    await queryClient.invalidateQueries({ queryKey: sessionQuery(auth).queryKey })
    onDone()
  }

  if (stale) {
    return (
      <View className="gap-3">
        <Text className="text-sm text-neutral-500">
          To change how you sign in, sign in again first.
        </Text>
        <Button label="Sign in again" onPress={signInAgain} />
      </View>
    )
  }

  if (to === undefined) {
    const { errors, isSubmitting } = addressForm.formState

    return (
      <View className="gap-4">
        <FormError errors={errors} />
        <Controller
          control={addressForm.control}
          name="to"
          render={({ field }) => (
            <Field
              label={`New ${NOUN[channel]}`}
              autoCapitalize="none"
              autoComplete={channel === 'email' ? 'email' : 'tel'}
              keyboardType={channel === 'email' ? 'email-address' : 'phone-pad'}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.to?.message}
            />
          )}
        />
        <Button
          label="Send a code there"
          disabled={isSubmitting}
          onPress={addressForm.handleSubmit(sendCode)}
        />
        <Link label="Cancel" onPress={onDone} />
      </View>
    )
  }

  const { errors, isSubmitting } = codeForm.formState

  return (
    <View className="gap-4">
      <Text className="text-sm text-neutral-500">
        If {to} is free, a 6-digit code is on its way there.
      </Text>
      <FormError errors={errors} />
      <Controller
        control={codeForm.control}
        name="code"
        render={({ field }) => (
          <Field
            label="Code"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.code?.message}
          />
        )}
      />
      <Button label="Confirm" disabled={isSubmitting} onPress={codeForm.handleSubmit(confirm)} />
      <Link label="Cancel" onPress={onDone} />
    </View>
  )
}
