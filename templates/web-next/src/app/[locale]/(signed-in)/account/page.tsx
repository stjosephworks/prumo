import type { Metadata } from 'next'
import { Account } from '@/features/profile/account'
import { messagesOfPage } from '@/i18n/server'

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/account'>): Promise<Metadata> {
  return { title: (await messagesOfPage(params)).profile.title }
}

export default async function Page({ params }: PageProps<'/[locale]/account'>) {
  const messages = await messagesOfPage(params)

  return (
    <>
      <h1 className="text-2xl font-semibold">{messages.profile.title}</h1>
      <Account />
    </>
  )
}
