import { API_URL } from '@test/support/fake-transport'
import { createTestQueryClient } from '@test/support/query-client'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Transport } from '@/api-contract'
import { createClients, Providers } from '@/features/clients/clients'

// Renders what a page holds at an address, with the clients over a fake API.
export function renderAt(path: string, ui: ReactNode, transport: Transport) {
  window.history.replaceState(null, '', path)

  return render(
    <Providers clients={createClients(API_URL, transport)} queryClient={createTestQueryClient()}>
      {ui}
    </Providers>,
  )
}
