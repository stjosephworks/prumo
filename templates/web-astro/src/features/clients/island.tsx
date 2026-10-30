import type { QueryClient } from '@tanstack/react-query'
import type { ComponentType } from 'react'
import { SignedIn } from '@/features/auth/signed-in'
import { type Clients, Providers } from '@/features/clients/clients'
import { I18nProvider } from '@/i18n/i18n'
import { BASE_LOCALE, type Locale } from '@/i18n/locales'

// What a test hands an island instead of the real API, and the language its page speaks, which the page passes.
type Given = { clients?: Clients; queryClient?: QueryClient; locale?: Locale }

// Each interactive part of a page is an island: a React root Astro mounts in the browser, as
// `<SignIn client:only="react" />`, and never renders on the server. Navigating between pages loads the next one, so
// each island brings its own clients, and in the signed-in area waits for the session before it shows anything.
export function island<P extends object>(Component: ComponentType<P>, { signedIn = false } = {}) {
  return function Island({ clients, queryClient, locale = BASE_LOCALE, ...props }: P & Given) {
    const content = <Component {...(props as P)} />

    return (
      <I18nProvider locale={locale}>
        <Providers clients={clients} queryClient={queryClient}>
          {signedIn ? <SignedIn>{content}</SignedIn> : content}
        </Providers>
      </I18nProvider>
    )
  }
}
