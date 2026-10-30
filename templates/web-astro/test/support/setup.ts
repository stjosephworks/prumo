import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { navigate } from '@/lib/navigate'

// A screen that waits on a query appears later when every app's tests run at once on a slow machine: a wait gets
// five seconds, not one, as a test gets fifteen.
configure({ asyncUtilTimeout: 5000 })

// jsdom cannot load another page, so a navigation is recorded rather than performed.
beforeEach(() => {
  vi.spyOn(navigate, 'to').mockImplementation(() => {})
  vi.spyOn(navigate, 'replace').mockImplementation(() => {})
})

// prumo:multi-language
// Every test starts with nothing chosen and a browser asking for no language, so the app speaks the project's base,
// whichever it is, and the words a test looks for come from its messages (support/messages.ts).
beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(navigator, 'languages', { value: [], configurable: true })
})
// prumo:end-multi-language

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})
