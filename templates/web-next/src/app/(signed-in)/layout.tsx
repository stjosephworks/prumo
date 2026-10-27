import { SignedIn } from '@/features/auth/signed-in'

export const metadata = { robots: { index: false } }

export default function SignedInLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <SignedIn>{children}</SignedIn>
    </main>
  )
}
