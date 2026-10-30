import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ResetPassword } from '@/features/auth/reset-password-form'
import { messagesOfPage } from '@/i18n/server'

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/reset-password'>): Promise<Metadata> {
  return { title: (await messagesOfPage(params)).auth.resetPassword.title }
}

export default async function Page({ params }: PageProps<'/[locale]/reset-password'>) {
  const messages = await messagesOfPage(params)

  return (
    <>
      <h1 className="text-2xl font-semibold">{messages.auth.resetPassword.title}</h1>
      <Suspense>
        <ResetPassword />
      </Suspense>
    </>
  )
}
