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

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})
