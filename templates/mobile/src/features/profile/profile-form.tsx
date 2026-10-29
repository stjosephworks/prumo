import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { View } from 'react-native'
import { z } from 'zod'
import { type ApiClient, type Profile, profileQuery, updateProfile } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'
import { LOCALES } from '@/i18n/locales'

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
    <View className="gap-6">
      <FormError errors={errors} />
      <Controller
        control={form.control}
        name="displayName"
        render={({ field }) => (
          <Field
            label="Display name"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.displayName?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="locale"
        render={({ field }) => (
          <Field
            label="Locale"
            autoCapitalize="none"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.locale?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="timezone"
        render={({ field }) => (
          <Field
            label="Timezone"
            autoCapitalize="none"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.timezone?.message}
          />
        )}
      />
      <Button label="Save" disabled={isSubmitting} onPress={form.handleSubmit(onSubmit)} />
    </View>
  )
}
