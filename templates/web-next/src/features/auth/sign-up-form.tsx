'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { type AuthClient, sessionQuery } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useClients } from '@/features/clients/clients'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'
import { useLocalePath, useMessages } from '@/i18n/i18n'

const schema = z.object({
  name: z.string().min(1).max(80),
  email: z.email(),
  password: z.string().min(8).max(128),
})

type SignUpValues = z.infer<typeof schema>

export function SignUpForm({ auth }: { auth: Pick<AuthClient, 'signUp' | 'getSession'> }) {
  const messages = useMessages()
  const localePath = useLocalePath()
  const queryClient = useQueryClient()
  const router = useRouter()
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
      router.push(`${localePath('/verify-email')}?${new URLSearchParams({ email: values.email })}`)
      return
    }

    // prumo:end-email

    // Invalidating is not enough: nothing observes the session here, and the signed-in area's guard would read the
    // cached null and send the user straight back. Refetching replaces it before the guard reads it.
    await queryClient.refetchQueries({ queryKey: sessionQuery(auth).queryKey })
    router.push(localePath('/account'))
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
        <Link href={localePath('/sign-in')}>{messages.auth.signUp.signIn}</Link>
      </p>
    </form>
  )
}

export function SignUp() {
  return <SignUpForm auth={useClients().auth} />
}
