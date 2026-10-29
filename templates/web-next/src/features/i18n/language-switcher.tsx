'use client'

import { useI18n } from '@/i18n/i18n'
import { isLocale, LOCALE_INFO, LOCALES } from '@/i18n/locales'

// The language of the screen, kept in a cookie and moved to at its own address. Signed in, the account follows it
// (account-language.ts). A project that speaks one language has nothing to choose.
export function LanguageSwitcher() {
  const { locale, messages, choose } = useI18n()

  if (LOCALES.length < 2) {
    return null
  }

  return (
    <label className="flex items-center gap-2 self-end text-sm text-muted-foreground">
      {messages.language}
      <select
        value={locale}
        onChange={(event) => isLocale(event.target.value) && choose(event.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1 text-foreground"
      >
        {LOCALES.map((each) => (
          <option key={each} value={each} lang={each}>
            {LOCALE_INFO[each].nativeName}
          </option>
        ))}
      </select>
    </label>
  )
}
