import type { Metadata } from 'next'
import { SignUp } from '@/features/auth/sign-up-form'

export const metadata: Metadata = { title: 'Create an account' }

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Create an account</h1>
      <SignUp />
    </>
  )
}
