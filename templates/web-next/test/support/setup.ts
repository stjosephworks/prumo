import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// A screen that waits on a query appears later when every app's tests run at once on a slow machine: a wait gets
// five seconds, not one, as a test gets fifteen.
configure({ asyncUtilTimeout: 5000 })

vi.mock('next/navigation', () => import('@test/support/navigation'))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  window.history.replaceState(null, '', '/')
})
