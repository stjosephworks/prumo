import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// A screen that waits on a query appears later when every app's tests run at once on a slow machine: a wait gets
// five seconds, not one, as a test gets fifteen.
configure({ asyncUtilTimeout: 5000 })

vi.mock('next/navigation', () => import('@test/support/navigation'))

// prumo:multi-language
// Every test starts with nothing chosen and a browser asking for no language, so the app speaks the project's base,
// whichever it is, and the words a test looks for come from its messages (support/messages.ts).
beforeEach(() => {
  document.cookie = 'locale=; path=/; max-age=0'
  Object.defineProperty(navigator, 'languages', { value: [], configurable: true })
})
// prumo:end-multi-language

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  window.history.replaceState(null, '', '/')
})
