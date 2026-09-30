import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory } from '@tanstack/react-router'
import { API_URL } from '@test/support/fake-transport'
import { render } from '@testing-library/react'
import { createClient, type Transport } from '@/api-contract'
import { App } from '@/app'
import { createAuth } from '@/features/auth/auth-client'

export function renderApp(path: string, transport: Transport) {
  const context = {
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    api: createClient({ baseUrl: API_URL, fetch: transport }),
    auth: createAuth({ baseUrl: API_URL, fetch: transport }),
  }

  return render(<App context={context} history={createMemoryHistory({ initialEntries: [path] })} />)
}
