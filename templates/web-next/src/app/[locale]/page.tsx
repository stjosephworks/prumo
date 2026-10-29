import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { LanguageSwitcher } from '@/features/i18n/language-switcher'
import { LOCALE_INFO, LOCALES, segmentOf } from '@/i18n/locales'
import { messagesFor } from '@/i18n/messages'
import { localeOfPage } from '@/i18n/server'

// A public page names its address in every language, so a search engine shows each person theirs.
export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const locale = await localeOfPage(params)
  const messages = messagesFor(locale)

  return {
    title: messages.home.title,
    description: messages.home.description,
    alternates: {
      canonical: `/${segmentOf(locale)}`,
      languages: Object.fromEntries(
        LOCALES.map((each) => [LOCALE_INFO[each].hreflang, `/${segmentOf(each)}`]),
      ),
    },
  }
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const locale = await localeOfPage(params)
  const messages = messagesFor(locale)

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-4 p-6">
      <LanguageSwitcher />
      <h1 className="text-4xl font-semibold tracking-tight">{messages.home.title}</h1>
      <p className="text-lg text-muted-foreground">{messages.home.body}</p>
      <Link
        href={`/${segmentOf(locale)}/account`}
        className={buttonVariants({ className: 'self-start' })}
      >
        {messages.home.signIn}
      </Link>
    </main>
  )
}
