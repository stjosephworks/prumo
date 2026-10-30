import { LOCALES, type Locale, segmentOf } from '@/i18n/locales'

// Every page is built once per language, at the address its language names.
export function localePaths(): { params: { locale: string }; props: { locale: Locale } }[] {
  return LOCALES.map((locale) => ({ params: { locale: segmentOf(locale) }, props: { locale } }))
}
