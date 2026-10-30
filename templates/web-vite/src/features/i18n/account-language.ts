import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { type ApiClient, profileQuery, updateProfile } from '@/api-contract'
import { useI18n } from '@/i18n/i18n'

// One language per person. Signed in on a browser where nothing was chosen, the screen speaks the account's; where a
// language was chosen, the account takes it, so mail arrives in the language the person reads.
export function useAccountLanguage(api: ApiClient): void {
  const queryClient = useQueryClient()
  const { locale, chosen, follow } = useI18n()
  const { data: profile } = useQuery(profileQuery(api))

  useEffect(() => {
    if (profile === undefined) {
      return
    }

    if (!chosen) {
      follow(profile.locale)
    } else if (profile.locale !== locale) {
      void updateProfile(api, { locale })
        .then(() => queryClient.invalidateQueries({ queryKey: profileQuery(api).queryKey }))
        .catch(() => undefined)
    }
  }, [api, chosen, follow, locale, profile, queryClient])
}
