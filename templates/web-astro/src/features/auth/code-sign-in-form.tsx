import { zodResolver } from '@hookform/resolvers/zod'
import { type HTMLInputAutoCompleteAttribute, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ApiError, type AuthClient } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useClients } from '@/features/clients/clients'
import { island } from '@/features/clients/island'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'
import { useCooldown } from '@/features/forms/use-cooldown'
import { rich, useLocalePath, useMessages } from '@/i18n/i18n'
import { format } from '@/i18n/locales'
import type { Messages } from '@/i18n/messages'
import { navigate } from '@/lib/navigate'

type Channel = 'email' | 'phone'

// The channels a sign-in code goes by in this project, the first leading.
const CHANNELS: Channel[] = [
  'email', // prumo:email-code
  'phone', // prumo:phone-code
]

type Address = {
  label: string
  type: 'email' | 'tel'
  autoComplete: HTMLInputAutoCompleteAttribute
  schema: z.ZodType<string, string>
  hint?: string
  switchTo: string
}

function addressOf(channel: Channel, messages: Messages): Address {
  // prumo:email-code
  if (channel === 'email') {
    return {
      label: messages.auth.email,
      type: 'email',
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
      type: 'tel',
      autoComplete: 'tel',
      schema: z.string().trim().min(1, messages.auth.code.phoneRequired),
      hint: messages.auth.code.phoneHint,
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

// Two steps on one page: the address, then the code sent to it. Entering it signs in, or creates the account.
export function CodeSignInForm({
  auth,
  redirect,
}: {
  auth: AuthClient
  redirect: string | undefined
}) {
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
        redirect={redirect}
        wait={wait}
        resend={() => send(sent.to, sent.channel)}
        onChangeAddress={() => setSent(undefined)}
      />
    )
  }

  const other = CHANNELS.find((each) => each !== channel)

  return (
    <>
      <AddressStep
        key={channel}
        address={addressOf(channel, messages)}
        send={(to) => send(to, channel)}
        onSent={(to) => setSent({ channel, to })}
      />
      {other !== undefined && (
        <Button type="button" variant="link" onClick={() => setChannel(other)}>
          {addressOf(other, messages).switchTo}
        </Button>
      )}
    </>
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
  const schema = z.object({ to: address.schema })
  const form = useForm<{ to: string }>({
    resolver: zodResolver(schema),
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
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FormError errors={errors} />
      <FieldGroup>
        <Field data-invalid={errors.to !== undefined}>
          <FieldLabel htmlFor="to">{address.label}</FieldLabel>
          <Input
            id="to"
            type={address.type}
            autoComplete={address.autoComplete}
            {...form.register('to')}
          />
          {address.hint !== undefined && <FieldDescription>{address.hint}</FieldDescription>}
          <FieldError errors={[errors.to]} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={isSubmitting}>
        {messages.auth.code.send}
      </Button>
      <p className="text-sm text-muted-foreground">{messages.auth.code.createsAccount}</p>
    </form>
  )
}

function CodeStep({
  auth,
  sent,
  redirect,
  wait,
  resend,
  onChangeAddress,
}: {
  auth: AuthClient
  sent: Sent
  redirect: string | undefined
  wait: number
  resend: () => Promise<boolean>
  onChangeAddress: () => void
}) {
  const messages = useMessages()
  const localePath = useLocalePath()
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

    // The next page is a new page load, with a cache of its own that asks for the session afresh.
    navigate.to(redirect ?? localePath('/account'))
  }

  async function sendAgain() {
    setResent(!(await resend()))
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {rich(messages.auth.code.sentTo, { to: <strong>{sent.to}</strong> })}
      </p>
      <FormError errors={errors} />
      <FieldGroup>
        <Field data-invalid={errors.code !== undefined}>
          <FieldLabel htmlFor="code">{messages.forms.code}</FieldLabel>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            {...form.register('code')}
          />
          <FieldError errors={[errors.code]} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={isSubmitting}>
        {messages.auth.signIn.submit}
      </Button>
      <Button type="button" variant="outline" onClick={sendAgain} disabled={wait > 0}>
        {wait > 0
          ? format(messages.forms.sendNewCodeIn, { seconds: wait })
          : messages.forms.sendNewCode}
      </Button>
      {resent && (
        <p role="status" className="text-sm text-muted-foreground">
          {messages.forms.newCodeSent}
        </p>
      )}
      <Button type="button" variant="link" onClick={onChangeAddress}>
        {anotherAddress(sent.channel, messages)}
      </Button>
    </form>
  )
}

// What the sign-in page renders for a code: the form, with the address the visitor was turned away from.
export function CodeSignInPart() {
  const { auth } = useClients()
  const redirect = new URLSearchParams(window.location.search).get('redirect') ?? undefined

  return <CodeSignInForm auth={auth} redirect={redirect} />
}

export const CodeSignIn = island(CodeSignInPart)
