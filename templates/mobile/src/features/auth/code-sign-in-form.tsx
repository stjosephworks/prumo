import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Pressable, Text, type TextInputProps, View } from 'react-native'
import { z } from 'zod'
import { ApiError, type AuthClient, sessionQuery } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'
import { useCooldown } from '@/features/forms/use-cooldown'
import { useMessages } from '@/i18n/i18n'
import { format } from '@/i18n/locales'
import type { Messages } from '@/i18n/messages'

type Channel = 'email' | 'phone'

// The channels a sign-in code goes by in this project, the first leading.
const CHANNELS: Channel[] = [
  'email', // prumo:email-code
  'phone', // prumo:phone-code
]

type Address = {
  label: string
  keyboardType: TextInputProps['keyboardType']
  autoComplete: TextInputProps['autoComplete']
  schema: z.ZodType<string, string>
  hint?: string
  switchTo: string
}

function addressOf(channel: Channel, messages: Messages): Address {
  // prumo:email-code
  if (channel === 'email') {
    return {
      label: messages.auth.email,
      keyboardType: 'email-address',
      autoComplete: 'email',
      schema: z.email(),
      switchTo: messages.auth.code.useEmail,
    }
  }

  // prumo:end-email-code
  // prumo:phone-code
  if (channel === 'phone') {
    return {
      label: messages.auth.code.phone,
      keyboardType: 'phone-pad',
      autoComplete: 'tel',
      schema: z.string().trim().min(1, messages.auth.code.phoneRequired),
      hint: 'A mobile number, with its country code, as +1 415 555 2671.',
      switchTo: messages.auth.code.usePhone,
    }
  }

  // prumo:end-phone-code
  throw new Error(`No sign-in code goes by ${channel}`)
}

function requestCode(auth: AuthClient, channel: Channel, to: string): Promise<void> {
  // prumo:email-code
  if (channel === 'email') {
    return auth.requestSignInCode(to)
  }

  // prumo:end-email-code
  // prumo:phone-code
  if (channel === 'phone') {
    return auth.requestPhoneCode(to)
  }

  // prumo:end-phone-code
  throw new Error(`No sign-in code goes by ${channel}`)
}

function signIn(auth: AuthClient, channel: Channel, to: string, code: string): Promise<void> {
  // prumo:email-code
  if (channel === 'email') {
    return auth.signInWithCode({ email: to, code })
  }

  // prumo:end-email-code
  // prumo:phone-code
  if (channel === 'phone') {
    return auth.signInWithPhoneCode({ phone: to, code })
  }

  // prumo:end-phone-code
  throw new Error(`No sign-in code goes by ${channel}`)
}

// The link back to the first step, worded for the channel the code went by.
function anotherAddress(channel: Channel, messages: Messages): string {
  // prumo:email-code
  if (channel === 'email') {
    return messages.auth.code.anotherEmail
  }

  // prumo:end-email-code
  // prumo:phone-code
  if (channel === 'phone') {
    return messages.auth.code.anotherNumber
  }

  // prumo:end-phone-code
  throw new Error(`No sign-in code goes by ${channel}`)
}

const codeSchemaOf = (messages: Messages) =>
  z.object({ code: z.string().regex(/^\d{6}$/, messages.forms.sixDigits) })

type CodeValues = z.infer<ReturnType<typeof codeSchemaOf>>

type Sent = { channel: Channel; to: string }

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      <Text className="text-sm text-neutral-900 underline">{label}</Text>
    </Pressable>
  )
}

// Two steps on one screen: the address, then the code sent to it. Entering it signs in, or creates the account.
export function CodeSignInForm({ auth, onSignedIn }: { auth: AuthClient; onSignedIn: () => void }) {
  const messages = useMessages()
  const [channel, setChannel] = useState<Channel>(CHANNELS[0] ?? 'email')
  const [sent, setSent] = useState<Sent>()
  const [wait, startWait] = useCooldown()

  // A code sent moments ago is still good, so a refusal to send another still leads to the code step.
  async function send(to: string, by: Channel): Promise<boolean> {
    try {
      await requestCode(auth, by, to)
    } catch (error) {
      if (error instanceof ApiError && error.retryAfter !== undefined) {
        startWait(error.retryAfter)
        return true
      }

      throw error
    }

    return false
  }

  if (sent !== undefined) {
    return (
      <CodeStep
        auth={auth}
        sent={sent}
        wait={wait}
        resend={() => send(sent.to, sent.channel)}
        onSignedIn={onSignedIn}
        onChangeAddress={() => setSent(undefined)}
      />
    )
  }

  const other = CHANNELS.find((each) => each !== channel)

  return (
    <View className="gap-6">
      <AddressStep
        key={channel}
        address={addressOf(channel, messages)}
        send={(to) => send(to, channel)}
        onSent={(to) => setSent({ channel, to })}
      />
      {other === undefined ? null : (
        <Link label={addressOf(other, messages).switchTo} onPress={() => setChannel(other)} />
      )}
    </View>
  )
}

function AddressStep({
  address,
  send,
  onSent,
}: {
  address: Address
  send: (to: string) => Promise<boolean>
  onSent: (to: string) => void
}) {
  const messages = useMessages()
  const form = useForm<{ to: string }>({
    resolver: zodResolver(z.object({ to: address.schema })),
    mode: 'onTouched',
    defaultValues: { to: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit({ to }: { to: string }) {
    try {
      await send(to)
    } catch (error) {
      applyServerError(error, ['to'], form.setError, messages)
      return
    }

    onSent(to)
  }

  return (
    <View className="gap-6">
      <FormError errors={errors} />
      <Controller
        control={form.control}
        name="to"
        render={({ field }) => (
          <Field
            label={address.label}
            autoCapitalize="none"
            autoComplete={address.autoComplete}
            keyboardType={address.keyboardType}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.to?.message}
          />
        )}
      />
      {address.hint === undefined ? null : (
        <Text className="text-sm text-neutral-500">{address.hint}</Text>
      )}
      <Button
        label={messages.auth.code.send}
        disabled={isSubmitting}
        onPress={form.handleSubmit(onSubmit)}
      />
      <Text className="text-sm text-neutral-500">{messages.auth.code.createsAccount}</Text>
    </View>
  )
}

function CodeStep({
  auth,
  sent,
  wait,
  resend,
  onSignedIn,
  onChangeAddress,
}: {
  auth: AuthClient
  sent: Sent
  wait: number
  resend: () => Promise<boolean>
  onSignedIn: () => void
  onChangeAddress: () => void
}) {
  const messages = useMessages()
  const queryClient = useQueryClient()
  const [resent, setResent] = useState(false)
  const form = useForm<CodeValues>({
    resolver: zodResolver(codeSchemaOf(messages)),
    mode: 'onTouched',
    defaultValues: { code: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: CodeValues) {
    try {
      await signIn(auth, sent.channel, sent.to, values.code)
    } catch (error) {
      applyServerError(error, ['code'], form.setError, messages)
      return
    }

    await queryClient.invalidateQueries({ queryKey: sessionQuery(auth).queryKey })
    onSignedIn()
  }

  async function sendAgain() {
    setResent(!(await resend()))
  }

  return (
    <View className="gap-6">
      <Text className="text-sm text-neutral-500">
        {format(messages.auth.code.sentTo, { to: sent.to })}
      </Text>
      <FormError errors={errors} />
      <Controller
        control={form.control}
        name="code"
        render={({ field }) => (
          <Field
            label={messages.forms.code}
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
      <Button
        label={messages.auth.signIn.submit}
        disabled={isSubmitting}
        onPress={form.handleSubmit(onSubmit)}
      />
      <Button
        label={
          wait > 0
            ? format(messages.forms.sendNewCodeIn, { seconds: wait })
            : messages.forms.sendNewCode
        }
        variant="outline"
        disabled={wait > 0}
        onPress={sendAgain}
      />
      {resent ? (
        <Text accessibilityRole="text" className="text-sm text-neutral-500">
          {messages.forms.newCodeSent}
        </Text>
      ) : null}
      <Link label={anotherAddress(sent.channel, messages)} onPress={onChangeAddress} />
    </View>
  )
}
