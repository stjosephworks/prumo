import { createContext, type ReactNode, useContext } from 'react'
import type { ApiClient, AuthClient } from '@/api-contract'

type Clients = { api: ApiClient; auth: AuthClient }

const ClientsContext = createContext<Clients | undefined>(undefined)

export function ClientsProvider({ clients, children }: { clients: Clients; children: ReactNode }) {
  return <ClientsContext.Provider value={clients}>{children}</ClientsContext.Provider>
}

export function useClients(): Clients {
  const clients = useContext(ClientsContext)

  if (clients === undefined) {
    throw new Error('useClients must be used inside ClientsProvider')
  }

  return clients
}
