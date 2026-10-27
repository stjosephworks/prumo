import { vi } from 'vitest'

// next/navigation needs the App Router mounted, which only `next` itself does. Tests stand in for it: the URL is
// jsdom's, and a navigation is recorded rather than performed, so a test asserts where the app would go.
export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}

export const useRouter = () => router
export const useSearchParams = () => new URLSearchParams(window.location.search)
export const usePathname = () => window.location.pathname
