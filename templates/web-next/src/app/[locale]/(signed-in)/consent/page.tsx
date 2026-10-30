import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Consent } from '@/features/oauth/consent-form'
import { messagesOfPage } from '@/i18n/server'

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/consent'>): Promise<Metadata> {
  return { title: (await messagesOfPage(params)).consent.title }
}

export default async function Page({ params }: PageProps<'/[locale]/consent'>) {
  const messages = await messagesOfPage(params)

  return (
    <>
      <h1 className="text-2xl font-semibold">{messages.consent.title}</h1>
      <Suspense>
        <Consent />
      </Suspense>
    </>
  )
}
