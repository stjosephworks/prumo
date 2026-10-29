import type { Metadata } from 'next'
import { SignUp } from '@/features/auth/sign-up-form'
import { messagesOfPage } from '@/i18n/server'

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/sign-up'>): Promise<Metadata> {
  return { title: (await messagesOfPage(params)).auth.signUp.title }
}

export default async function Page({ params }: PageProps<'/[locale]/sign-up'>) {
  const messages = await messagesOfPage(params)

  return (
    <>
      <h1 className="text-2xl font-semibold">{messages.auth.signUp.title}</h1>
      <SignUp />
    </>
  )
}
