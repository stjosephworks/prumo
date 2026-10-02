import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory } from '@tanstack/react-router'
import { API_URL } from '@test/support/fake-transport'
import { render } from '@testing-library/react'
import { createAuthClient, createClient, type Transport } from '@/api-contract'
import { App } from '@/app'

export function renderApp(path: string, transport: Transport) {
  const auth = createAuthClient({ baseUrl: API_URL, fetch: transport })
  const context = {
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    api: createClient({ baseUrl: API_URL, fetch: auth.fetch }),
    auth,
  }

  return render(<App context={context} history={createMemoryHistory({ initialEntries: [path] })} />)
}
