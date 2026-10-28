import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type HTMLInputAutoCompleteAttribute, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ApiError, type AuthClient, sessionQuery } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'
import { useCooldown } from '@/features/forms/use-cooldown'

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

function addressOf(channel: Channel): Address {
  // prumo:email-code
  if (channel === 'email') {
    return {
      label: 'Email',
      type: 'email',
      autoComplete: 'email',
      schema: z.email(),
      switchTo: 'Use email instead',
    }
  }

  // prumo:end-email-code
  // prumo:phone-code
  if (channel === 'phone') {
    return {
      label: 'Phone number',
      type: 'tel',
      autoComplete: 'tel',
      schema: z.string().trim().min(1, 'Enter your mobile number'),
      hint: 'A mobile number, with its country code, as +1 415 555 2671.',
      switchTo: 'Use a phone number instead',
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

const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6 digits we sent') })

type CodeValues = z.infer<typeof codeSchema>

type Sent = { channel: Channel; to: string }

// Two steps on one page: the address, then the code sent to it. Entering it signs in, or creates the account.
export function CodeSignInForm({
  auth,
  redirect,
}: {
  auth: AuthClient
  redirect: string | undefined
}) {
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
        address={addressOf(channel)}
        send={(to) => send(to, channel)}
        onSent={(to) => setSent({ channel, to })}
      />
      {other !== undefined && (
        <Button type="button" variant="link" onClick={() => setChannel(other)}>
          {addressOf(other).switchTo}
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
      applyServerError(error, ['to'], form.setError)
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
        Send me a code
      </Button>
      <p className="text-sm text-muted-foreground">No account yet? The code creates one.</p>
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
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [resent, setResent] = useState(false)
  const form = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    mode: 'onTouched',
    defaultValues: { code: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: CodeValues) {
    try {
      await signIn(auth, sent.channel, sent.to, values.code)
    } catch (error) {
      applyServerError(error, ['code'], form.setError)
      return
    }

    // Refetching replaces the cached null before the protected route reads it.
    await queryClient.refetchQueries({ queryKey: sessionQuery(auth).queryKey })
    await navigate({ to: redirect ?? '/' })
  }

  async function sendAgain() {
    setResent(!(await resend()))
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        We sent a 6-digit code to <strong>{sent.to}</strong>.
      </p>
      <FormError errors={errors} />
      <FieldGroup>
        <Field data-invalid={errors.code !== undefined}>
          <FieldLabel htmlFor="code">Code</FieldLabel>
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
        Sign in
      </Button>
      <Button type="button" variant="outline" onClick={sendAgain} disabled={wait > 0}>
        {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
      </Button>
      {resent && (
        <p role="status" className="text-sm text-muted-foreground">
          A new code is on its way. The previous one no longer works.
        </p>
      )}
      <Button type="button" variant="link" onClick={onChangeAddress}>
        {sent.channel === 'phone' ? 'Use another number' : 'Use another email'}
      </Button>
    </form>
  )
}
