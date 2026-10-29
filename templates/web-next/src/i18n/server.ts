import { notFound } from 'next/navigation'
import { type Locale, localeOfSegment } from '@/i18n/locales'
import { type Messages, messagesFor } from '@/i18n/messages'

// The language a page's address names. An address naming none of the project's is no page of the app.
export async function localeOfPage(params: Promise<{ locale: string }>): Promise<Locale> {
  const locale = localeOfSegment((await params).locale)

  if (locale === undefined) {
    notFound()
  }

  return locale
}

// What a page rendered on the server says, in the language of its address.
export async function messagesOfPage(params: Promise<{ locale: string }>): Promise<Messages> {
  return messagesFor(await localeOfPage(params))
}
