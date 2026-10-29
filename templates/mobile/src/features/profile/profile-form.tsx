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
    <View className="gap-6">
      <FormError errors={errors} />
      <Controller
        control={form.control}
        name="displayName"
        render={({ field }) => (
          <Field
            label={messages.profile.displayName}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.displayName?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="timezone"
        render={({ field }) => (
          <Field
            label={messages.profile.timezone}
            autoCapitalize="none"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.timezone?.message}
          />
        )}
      />
      <Button
        label={messages.profile.save}
        disabled={isSubmitting}
        onPress={form.handleSubmit(onSubmit)}
      />
    </View>
  )
}
