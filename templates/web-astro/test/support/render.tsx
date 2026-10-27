import { API_URL } from '@test/support/fake-transport'
import { createTestQueryClient } from '@test/support/query-client'
import { render } from '@testing-library/react'
import type { ComponentType, ReactNode } from 'react'
import type { Transport } from '@/api-contract'
import { type Clients, createClients, Providers } from '@/features/clients/clients'

type Island = ComponentType<{
  clients?: Clients
  queryClient?: ReturnType<typeof createTestQueryClient>
}>

// Mounts an island as its page would, at an address, with its clients over a fake API.
export function renderIsland(path: string, Island: Island, transport: Transport) {
  window.history.replaceState(null, '', path)

  return render(
    <Island clients={createClients(API_URL, transport)} queryClient={createTestQueryClient()} />,
  )
}

// Renders a part that is not an island of its own, inside the clients an island would give it.
export function renderAt(path: string, ui: ReactNode, transport: Transport) {
  window.history.replaceState(null, '', path)

  return render(
    <Providers clients={createClients(API_URL, transport)} queryClient={createTestQueryClient()}>
      {ui}
    </Providers>,
  )
}
