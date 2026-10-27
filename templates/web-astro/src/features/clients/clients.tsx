import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createContext, type ReactNode, useContext, useState } from 'react'
import {
  type ApiClient,
  type AuthClient,
  createAuthClient,
  createClient,
  type Transport,
} from '@/api-contract'
import { config } from '@/config'

export type Clients = { api: ApiClient; auth: AuthClient }

const ClientsContext = createContext<Clients | null>(null)

const transport: Transport = (input, init) => fetch(input, { ...init, credentials: 'include' })

export function createClients(baseUrl = config.PUBLIC_API_URL, fetch = transport): Clients {
  const auth = createAuthClient({ baseUrl, fetch })

  // Through the auth client, so an expired access token is refreshed and the request repeated.
  return { api: createClient({ baseUrl, fetch: auth.fetch }), auth }
}

// The browser's side of an island: one query cache and one pair of clients. Pages are built ahead of time with
// neither, since there is no user to ask the API as.
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
