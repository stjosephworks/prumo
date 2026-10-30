import { API_URL } from '@test/support/fake-transport'
import { createTestQueryClient } from '@test/support/query-client'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Transport } from '@/api-contract'
import { createClients, Providers } from '@/features/clients/clients'
import { I18nProvider, withLanguage } from '@/i18n/i18n'
import { BASE_LOCALE } from '@/i18n/locales'

// Renders what a page holds at an address, with the clients over a fake API.
export function renderAt(path: string, ui: ReactNode, transport: Transport) {
  window.history.replaceState(null, '', path)

  // As the root layout does, in the base language: the language a test's address names is the app's to read. // prumo:multi-language
  return render(
    <I18nProvider locale={BASE_LOCALE}>
      <Providers
        clients={createClients(API_URL, withLanguage(transport))}
        queryClient={createTestQueryClient()}
      >
        {ui}
      </Providers>
    </I18nProvider>,
  )
}
