import { SignedIn } from '@/features/auth/signed-in'
import { LanguageSwitcher } from '@/features/i18n/language-switcher'

export const metadata = { robots: { index: false } }

export default function SignedInLayout({ children }: LayoutProps<'/[locale]'>) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <LanguageSwitcher />
      <SignedIn>{children}</SignedIn>
    </main>
  )
}
