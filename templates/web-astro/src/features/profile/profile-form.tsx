import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { type ApiClient, LOCALES, type Profile, profileQuery, updateProfile } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'

const schema = z.object({
  displayName: z.string().min(1).max(80),
  locale: z.enum(LOCALES),
  timezone: z.string().min(1).max(64),
})

type ProfileValues = z.infer<typeof schema>

const FIELDS = ['displayName', 'locale', 'timezone'] as const

export function ProfileForm({ api, profile }: { api: ApiClient; profile: Profile }) {
  const queryClient = useQueryClient()
  const form = useForm<ProfileValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      displayName: profile.displayName,
      locale: profile.locale,
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
      applyServerError(error, FIELDS, form.setError)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FormError errors={errors} />
      <FieldGroup>
        <Field data-invalid={errors.displayName !== undefined}>
          <FieldLabel htmlFor="displayName">Display name</FieldLabel>
          <Input id="displayName" {...form.register('displayName')} />
          <FieldError errors={[errors.displayName]} />
        </Field>
        <Field data-invalid={errors.locale !== undefined}>
          <FieldLabel htmlFor="locale">Locale</FieldLabel>
          <Input id="locale" {...form.register('locale')} />
          <FieldError errors={[errors.locale]} />
        </Field>
        <Field data-invalid={errors.timezone !== undefined}>
          <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
          <Input id="timezone" {...form.register('timezone')} />
          <FieldError errors={[errors.timezone]} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={isSubmitting}>
        Save
      </Button>
    </form>
  )
}
