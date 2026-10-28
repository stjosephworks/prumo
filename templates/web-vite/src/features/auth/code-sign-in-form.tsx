import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ApiError, type AuthClient, sessionQuery } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'
import { useCooldown } from '@/features/forms/use-cooldown'

const addressSchema = z.object({ email: z.email() })

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6 digits from the email'),
})

type AddressValues = z.infer<typeof addressSchema>

type CodeValues = z.infer<typeof codeSchema>

type Auth = Pick<AuthClient, 'requestSignInCode' | 'signInWithCode' | 'getSession'>

// Two steps on one page: the address, then the code sent to it. Entering it signs in, or creates the account.
export function CodeSignInForm({ auth, redirect }: { auth: Auth; redirect: string | undefined }) {
  const [email, setEmail] = useState<string>()
  const [wait, startWait] = useCooldown()

  // A code sent moments ago is still good, so a refusal to send another still leads to the code step.
  async function send(address: string): Promise<boolean> {
    try {
      await auth.requestSignInCode(address)
    } catch (error) {
      if (error instanceof ApiError && error.retryAfter !== undefined) {
        startWait(error.retryAfter)
        return true
      }

      throw error
    }

    return false
  }

  return email === undefined ? (
    <AddressStep send={send} onSent={setEmail} />
  ) : (
    <CodeStep
      auth={auth}
      email={email}
      redirect={redirect}
      wait={wait}
      resend={() => send(email)}
      onChangeAddress={() => setEmail(undefined)}
    />
  )
}

function AddressStep({
  send,
  onSent,
}: {
  send: (address: string) => Promise<boolean>
  onSent: (address: string) => void
}) {
  const form = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    mode: 'onTouched',
    defaultValues: { email: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: AddressValues) {
    try {
      await send(values.email)
    } catch (error) {
      applyServerError(error, ['email'], form.setError)
      return
    }

    onSent(values.email)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FormError errors={errors} />
      <FieldGroup>
        <Field data-invalid={errors.email !== undefined}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
          <FieldError errors={[errors.email]} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={isSubmitting}>
        Email me a code
      </Button>
      <p className="text-sm text-muted-foreground">No account yet? The code creates one.</p>
    </form>
  )
}

function CodeStep({
  auth,
  email,
  redirect,
  wait,
  resend,
  onChangeAddress,
}: {
  auth: Auth
  email: string
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
      await auth.signInWithCode({ email, code: values.code })
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
        We sent a 6-digit code to <strong>{email}</strong>.
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
        Use another email
      </Button>
    </form>
  )
}
