import { createMemoryHistory } from '@tanstack/react-router'
import { API_URL } from '@test/support/fake-transport'
import { createTestQueryClient } from '@test/support/query-client'
import { render } from '@testing-library/react'
import { createAuthClient, createClient, type Transport } from '@/api-contract'
import { App } from '@/app'
import { withLanguage } from '@/i18n/i18n'

export function renderApp(path: string, transport: Transport) {
  const auth = createAuthClient({ baseUrl: API_URL, fetch: withLanguage(transport) })
  const context = {
    queryClient: createTestQueryClient(),
    api: createClient({ baseUrl: API_URL, fetch: auth.fetch }),
    auth,
  }

  return render(<App context={context} history={createMemoryHistory({ initialEntries: [path] })} />)
}
