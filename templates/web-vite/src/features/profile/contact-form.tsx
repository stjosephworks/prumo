import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'
import { rich, useMessages } from '@/i18n/i18n'
import type { Messages } from '@/i18n/messages'

type Channel = 'email' | 'phone'

// The addresses this project reaches people at, and so lets them change.
const CHANNELS: Channel[] = [
  'email', // prumo:mail
  'phone', // prumo:sms
]

type Words = { label: string; add: string; change: string; newLabel: string }

// How the profile names each address, and what it offers to do with it.
function wordsOf(channel: Channel, messages: Messages): Words {
  const words = messages.profile.contact

  // prumo:mail
  if (channel === 'email') {
    return {
      label: words.email,
      add: words.addEmail,
      change: words.changeEmail,
      newLabel: words.newEmail,
    }
  }

  // prumo:end-mail
  // prumo:sms
  if (channel === 'phone') {
    return {
      label: words.phone,
      add: words.addPhone,
      change: words.changePhone,
      newLabel: words.newPhone,
    }
  }

  // prumo:end-sms
  throw new Error(`Nothing changes by ${channel}`)
}

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

// How the signed-in person is reached, and so signs in: each address, and a way to change it with a code sent there.
export function ContactForm({ api, auth }: { api: ApiClient; auth: AuthClient }) {
  const messages = useMessages()
  const { data: session } = useQuery(sessionQuery(auth))
  const [editing, setEditing] = useState<Channel>()

  if (session === undefined || session === null) {
    return null
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{messages.profile.contact.title}</h2>
      {CHANNELS.map((channel) => {
        const current = currentOf(session.user, channel)
        const words = wordsOf(channel, messages)

        return (
          <div key={channel} className="flex flex-col gap-3">
            <p className="text-sm">
              {rich(messages.profile.contact.current, {
                channel: words.label,
                address: <strong>{current ?? messages.profile.contact.none}</strong>,
              })}
            </p>
            {editing === channel ? (
              <ChangeAddress
                api={api}
                auth={auth}
                channel={channel}
                onDone={() => setEditing(undefined)}
              />
            ) : (
              <Button type="button" variant="outline" onClick={() => setEditing(channel)}>
                {current === null ? words.add : words.change}
              </Button>
            )}
          </div>
        )
      })}
    </section>
  )
}

const codeSchemaOf = (messages: Messages) =>
  z.object({ code: z.string().regex(/^\d{6}$/, messages.forms.sixDigits) })

function ChangeAddress({
  api,
  auth,
  channel,
  onDone,
}: {
  api: ApiClient
  auth: AuthClient
  channel: Channel
  onDone: () => void
}) {
  const messages = useMessages()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const codeSchema = useMemo(() => codeSchemaOf(messages), [messages])
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
    await navigate({ to: '/sign-in', search: { redirect: '/' } })
  }

  async function sendCode({ to: address }: { to: string }) {
    try {
      await requestChange(api, channel, address)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'reauthentication_required') {
        setStale(true)
        return
      }

      applyServerError(error, ['to'], addressForm.setError, messages)
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
      applyServerError(error, ['code'], codeForm.setError, messages)
      return
    }

    await queryClient.refetchQueries({ queryKey: sessionQuery(auth).queryKey })
    onDone()
  }

  if (stale) {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="text-sm text-muted-foreground">
          {messages.profile.contact.stale}
        </p>
        <Button type="button" onClick={signInAgain}>
          {messages.forms.signInAgain}
        </Button>
      </div>
    )
  }

  if (to === undefined) {
    const { errors, isSubmitting } = addressForm.formState

    return (
      <form
        onSubmit={addressForm.handleSubmit(sendCode)}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormError errors={errors} />
        <FieldGroup>
          <Field data-invalid={errors.to !== undefined}>
            <FieldLabel htmlFor={`new-${channel}`}>
              {wordsOf(channel, messages).newLabel}
            </FieldLabel>
            <Input
              id={`new-${channel}`}
              type={channel === 'email' ? 'email' : 'tel'}
              autoComplete={channel === 'email' ? 'email' : 'tel'}
              {...addressForm.register('to')}
            />
            <FieldError errors={[errors.to]} />
          </Field>
        </FieldGroup>
        <Button type="submit" disabled={isSubmitting}>
          {messages.profile.contact.send}
        </Button>
        <Button type="button" variant="link" onClick={onDone}>
          {messages.forms.cancel}
        </Button>
      </form>
    )
  }

  const { errors, isSubmitting } = codeForm.formState

  return (
    <form onSubmit={codeForm.handleSubmit(confirm)} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {rich(messages.profile.contact.sentTo, { to: <strong>{to}</strong> })}
      </p>
      <FormError errors={errors} />
      <FieldGroup>
        <Field data-invalid={errors.code !== undefined}>
          <FieldLabel htmlFor={`code-${channel}`}>{messages.forms.code}</FieldLabel>
          <Input
            id={`code-${channel}`}
            inputMode="numeric"
            autoComplete="one-time-code"
            {...codeForm.register('code')}
          />
          <FieldError errors={[errors.code]} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={isSubmitting}>
        {messages.profile.contact.confirm}
      </Button>
      <Button type="button" variant="link" onClick={onDone}>
        {messages.forms.cancel}
      </Button>
    </form>
  )
}
