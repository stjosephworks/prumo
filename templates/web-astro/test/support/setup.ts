import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { navigate } from '@/lib/navigate'

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
