import type { Metadata } from 'next'
import { Suspense } from 'react'
import { VerifyEmail } from '@/features/auth/verify-email-form'
import { messagesOfPage } from '@/i18n/server'

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/verify-email'>): Promise<Metadata> {
  return { title: (await messagesOfPage(params)).auth.verifyEmail.title }
}

export default async function Page({ params }: PageProps<'/[locale]/verify-email'>) {
  const messages = await messagesOfPage(params)

  return (
    <>
      <h1 className="text-2xl font-semibold">{messages.auth.verifyEmail.title}</h1>
      <Suspense>
        <VerifyEmail />
      </Suspense>
    </>
  )
}
