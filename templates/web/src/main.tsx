import '@/index.css'
import { QueryClient } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createAuthClient, createClient, type Transport } from '@/api-contract'
import { App } from './app'
import { config } from './config'

const transport: Transport = (input, init) => fetch(input, { ...init, credentials: 'include' })

const auth = createAuthClient({ baseUrl: config.VITE_API_URL, fetch: transport })

const context = {
  queryClient: new QueryClient(),
  // Through the auth client, so an expired access token is refreshed and the request repeated.
  api: createClient({ baseUrl: config.VITE_API_URL, fetch: auth.fetch }),
  auth,
}

const root = document.getElementById('root')

if (root === null) {
  throw new Error('Missing #root element')
}

createRoot(root).render(
  <StrictMode>
    <App context={context} />
  </StrictMode>,
)
