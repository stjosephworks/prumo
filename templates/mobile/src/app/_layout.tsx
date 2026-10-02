import '@/global.css'
import { QueryClient, useQuery } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useState } from 'react'
import { createAuthClient, createClient, sessionQuery } from '@/api-contract'
import { config } from '@/config'
import { secureTokenStore } from '@/features/auth/token-store'
import { ClientsProvider, useClients } from '@/features/clients/clients-context'
import { QUERY_CACHE_MAX_AGE, queryPersister } from '@/features/storage/query-persister'

SplashScreen.preventAutoHideAsync()

function createClients() {
  const auth = createAuthClient({ baseUrl: config.apiUrl, fetch, tokens: secureTokenStore })
  // Through the auth client, so every request carries the bearer and an expired one is refreshed and repeated.
  const api = createClient({ baseUrl: config.apiUrl, fetch: auth.fetch })

  return { auth, api }
}

function Navigation() {
  const { auth } = useClients()
  const session = useQuery(sessionQuery(auth))

  useEffect(() => {
    if (!session.isPending) {
      SplashScreen.hideAsync()
    }
  }, [session.isPending])

  if (session.isPending) {
    return null
  }

  return <Stack screenOptions={{ headerShown: false }} />
}

export default function RootLayout() {
  const [clients] = useState(createClients)
  const [queryClient] = useState(() => new QueryClient())

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister, maxAge: QUERY_CACHE_MAX_AGE }}
    >
      <ClientsProvider clients={clients}>
        <Navigation />
      </ClientsProvider>
    </PersistQueryClientProvider>
  )
}
