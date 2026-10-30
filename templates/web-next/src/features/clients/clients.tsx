'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createContext, type ReactNode, useContext, useState } from 'react'
// prumo:single-language
// import { z } from 'zod'
// prumo:end-single-language
import {
  type ApiClient,
  type AuthClient,
  createAuthClient,
  createClient,
  type Transport,
} from '@/api-contract'
import { config } from '@/config'
import { withLanguage } from '@/i18n/i18n'

// prumo:single-language
// // zod's own messages, for what a form refuses before it is sent, in the project's language.
// z.config(z.locales.en()) // prumo:en
// z.config(z.locales.pt()) // prumo:pt-BR
// z.config(z.locales.es()) // prumo:es-419
//
// prumo:end-single-language
export type Clients = { api: ApiClient; auth: AuthClient }

const ClientsContext = createContext<Clients | null>(null)

// Every request names the language the screen speaks (withLanguage), as the cookies it signs in with. // prumo:multi-language
// Every request carries the cookies it signs in with. // prumo:single-language
const transport: Transport = withLanguage((input, init) =>
  fetch(input, { ...init, credentials: 'include' }),
)

export function createClients(baseUrl = config.NEXT_PUBLIC_API_URL, fetch = transport): Clients {
  const auth = createAuthClient({ baseUrl, fetch })

  // Through the auth client, so an expired access token is refreshed and the request repeated.
  return { api: createClient({ baseUrl, fetch: auth.fetch }), auth }
}

// The browser's side of the app: one query cache and one pair of clients for the whole tab. The server renders public
// pages without either, since it has no user to ask the API as.
export function Providers({
  children,
  clients: given,
  queryClient: givenQueryClient,
}: {
  children: ReactNode
  clients?: Clients
  queryClient?: QueryClient
}) {
  const [clients] = useState(() => given ?? createClients())
  const [queryClient] = useState(() => givenQueryClient ?? new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <ClientsContext.Provider value={clients}>{children}</ClientsContext.Provider>
    </QueryClientProvider>
  )
}

export function useClients(): Clients {
  const clients = useContext(ClientsContext)

  if (clients === null) {
    throw new Error('useClients is called outside <Providers>')
  }

  return clients
}
