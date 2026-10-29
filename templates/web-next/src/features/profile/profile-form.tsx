'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { type ApiClient, type Profile, profileQuery, updateProfile } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'
import { useMessages } from '@/i18n/i18n'

// The language is chosen where the screen's is, and the account follows it (features/i18n/account-language.ts).
const schema = z.object({
  displayName: z.string().min(1).max(80),
  timezone: z.string().min(1).max(64),
})

type ProfileValues = z.infer<typeof schema>

const FIELDS = ['displayName', 'timezone'] as const

export function ProfileForm({ api, profile }: { api: ApiClient; profile: Profile }) {
  const messages = useMessages()
  const queryClient = useQueryClient()
  const form = useForm<ProfileValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      displayName: profile.displayName,
      timezone: profile.timezone,
    },
  })
  const { errors, isSubmitting } = form.formState

  const mutation = useMutation({
    mutationFn: (values: ProfileValues) => updateProfile(api, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileQuery(api).queryKey }),
  })

  async function onSubmit(values: ProfileValues) {
    try {
      await mutation.mutateAsync(values)
    } catch (error) {
      applyServerError(error, FIELDS, form.setError, messages)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FormError errors={errors} />
      <FieldGroup>
        <Field data-invalid={errors.displayName !== undefined}>
          <FieldLabel htmlFor="displayName">{messages.profile.displayName}</FieldLabel>
          <Input id="displayName" {...form.register('displayName')} />
          <FieldError errors={[errors.displayName]} />
        </Field>
        <Field data-invalid={errors.timezone !== undefined}>
          <FieldLabel htmlFor="timezone">{messages.profile.timezone}</FieldLabel>
          <Input id="timezone" {...form.register('timezone')} />
          <FieldError errors={[errors.timezone]} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={isSubmitting}>
        {messages.profile.save}
      </Button>
    </form>
  )
}
