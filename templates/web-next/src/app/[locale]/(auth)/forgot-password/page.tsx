import type { Metadata } from 'next'
import { ForgotPassword } from '@/features/auth/forgot-password-form'
import { messagesOfPage } from '@/i18n/server'

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/forgot-password'>): Promise<Metadata> {
  return { title: (await messagesOfPage(params)).auth.forgotPassword.title }
}

export default async function Page({ params }: PageProps<'/[locale]/forgot-password'>) {
  const messages = await messagesOfPage(params)

  return (
    <>
      <h1 className="text-2xl font-semibold">{messages.auth.forgotPassword.title}</h1>
      <ForgotPassword />
    </>
  )
}
