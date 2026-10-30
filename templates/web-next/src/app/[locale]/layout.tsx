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

// prumo:multi-language
// Every page is built once per language, at its own address; an address naming another language is no page.
export const dynamicParams = false
// prumo:end-multi-language

// What a page's relative addresses resolve against, as the links it names to itself, which must be whole.
export const metadata: Metadata = { metadataBase: new URL(config.NEXT_PUBLIC_SITE_URL) }

// prumo:multi-language
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale: segmentOf(locale) }))
}

export default async function RootLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const locale = await localeOfPage(params)

  return (
    <html lang={locale} className={cn('font-sans', geist.variable)}>
      {/* prumo:end-multi-language */}
      {/* prumo:single-language */}
      {/* export default function RootLayout({ children }: LayoutProps<'/[locale]'>) { */}
      {/*   return ( */}
      {/*     <html lang={BASE_LOCALE} className={cn('font-sans', geist.variable)}> */}
      {/* prumo:end-single-language */}
      <body>
        <I18nProvider locale={locale}>
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  )
}
