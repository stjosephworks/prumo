import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { type ApiClient, profileQuery, updateProfile } from '@/api-contract'
import { useI18n } from '@/i18n/i18n'

// One language per person. Signed in where nothing was chosen in the app, the screen speaks the account's; once
// something was, a language or the phone's, the account takes the one the screen speaks, so mail arrives in it.
export function useAccountLanguage(api: ApiClient): void {
  const queryClient = useQueryClient()
  const { locale, chosen, follow } = useI18n()
  const { data: profile } = useQuery(profileQuery(api))

  useEffect(() => {
    if (profile === undefined) {
      return
    }

    if (chosen === undefined) {
      follow(profile.locale)
    } else if (profile.locale !== locale) {
      void updateProfile(api, { locale })
        .then(() => queryClient.invalidateQueries({ queryKey: profileQuery(api).queryKey }))
        .catch(() => undefined)
    }
  }, [api, chosen, follow, locale, profile, queryClient])
}
