import type { QueryClient } from '@tanstack/react-query'
import type { ComponentType } from 'react'
import { SignedIn } from '@/features/auth/signed-in'
import { type Clients, Providers } from '@/features/clients/clients'

// What a test hands an island instead of the real API.
type Given = { clients?: Clients; queryClient?: QueryClient }

// Each interactive part of a page is an island: a React root Astro mounts in the browser, as
// `<SignIn client:only="react" />`, and never renders on the server. Navigating between pages loads the next one, so
// each island brings its own clients, and in the signed-in area waits for the session before it shows anything.
export function island<P extends object>(Component: ComponentType<P>, { signedIn = false } = {}) {
  return function Island({ clients, queryClient, ...props }: P & Given) {
    const content = <Component {...(props as P)} />

    return (
      <Providers clients={clients} queryClient={queryClient}>
        {signedIn ? <SignedIn>{content}</SignedIn> : content}
      </Providers>
    )
  }
}
