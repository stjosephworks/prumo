import type { Metadata } from 'next'
import { Account } from '@/features/profile/account'

export const metadata: Metadata = { title: 'Your profile' }

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Your profile</h1>
      <Account />
    </>
  )
}
