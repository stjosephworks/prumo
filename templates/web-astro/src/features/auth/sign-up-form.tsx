import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { AuthClient } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useClients } from '@/features/clients/clients'
import { island } from '@/features/clients/island'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'
import { useLocalePath, useMessages } from '@/i18n/i18n'
import { navigate } from '@/lib/navigate'

const schema = z.object({
  name: z.string().min(1).max(80),
  email: z.email(),
  password: z.string().min(8).max(128),
})

type SignUpValues = z.infer<typeof schema>

export function SignUpForm({ auth }: { auth: Pick<AuthClient, 'signUp'> }) {
  const messages = useMessages()
  const localePath = useLocalePath()
  const form = useForm<SignUpValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { name: '', email: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: SignUpValues) {
    const result = await auth.signUp(values).catch((error: unknown) => {
      applyServerError(error, ['name', 'email', 'password'], form.setError, messages)
      return undefined
    })

    if (result === undefined) {
      return
    }

    // prumo:email
    if (result.verificationRequired) {
      navigate.to(`${localePath('/verify-email')}?${new URLSearchParams({ email: values.email })}`)
      return
    }

    // prumo:end-email

    // The next page is a new page load, with a cache of its own that asks for the session afresh.
    navigate.to(localePath('/account'))
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FormError errors={errors} />
      <FieldGroup>
        <Field data-invalid={errors.name !== undefined}>
          <FieldLabel htmlFor="name">{messages.auth.signUp.name}</FieldLabel>
          <Input id="name" autoComplete="name" {...form.register('name')} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={errors.email !== undefined}>
          <FieldLabel htmlFor="email">{messages.auth.email}</FieldLabel>
          <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={errors.password !== undefined}>
          <FieldLabel htmlFor="password">{messages.auth.signIn.password}</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...form.register('password')}
          />
          <FieldError errors={[errors.password]} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={isSubmitting}>
        {messages.auth.signUp.submit}
      </Button>
      <p className="text-sm text-muted-foreground">
        {messages.auth.signUp.registered}{' '}
        <a href={localePath('/sign-in')}>{messages.auth.signUp.signIn}</a>
      </p>
    </form>
  )
}

function SignUpPart() {
  return <SignUpForm auth={useClients().auth} />
}

export const SignUp = island(SignUpPart)
