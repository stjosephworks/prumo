import '../globals.css'
import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { config } from '@/config'
import { Providers } from '@/features/clients/clients'
import { I18nProvider } from '@/i18n/i18n'
import { LOCALES, segmentOf } from '@/i18n/locales'
import { localeOfPage } from '@/i18n/server'
import { cn } from '@/lib/utils'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

// Every page is built once per language, at its own address; an address naming another language is no page.
export const dynamicParams = false

// What a page's relative addresses resolve against, as its hreflang and canonical links, which must be whole.
export const metadata: Metadata = { metadataBase: new URL(config.NEXT_PUBLIC_SITE_URL) }

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale: segmentOf(locale) }))
}

export default async function RootLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const locale = await localeOfPage(params)

  return (
    <html lang={locale} className={cn('font-sans', geist.variable)}>
      <body>
        <I18nProvider locale={locale}>
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  )
}
