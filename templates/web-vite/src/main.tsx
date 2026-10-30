import '@/index.css'
import { QueryClient } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// prumo:single-language
// import { z } from 'zod'
// prumo:end-single-language
import { createAuthClient, createClient, type Transport } from '@/api-contract'
import { withLanguage } from '@/i18n/i18n'
import { App } from './app'
import { config } from './config'

// prumo:single-language
// // zod's own messages, for what a form refuses before it is sent, in the project's language.
// z.config(z.locales.en()) // prumo:en
// z.config(z.locales.pt()) // prumo:pt-BR
// z.config(z.locales.es()) // prumo:es-419
//
// prumo:end-single-language
const transport: Transport = withLanguage((input, init) =>
  fetch(input, { ...init, credentials: 'include' }),
)

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
