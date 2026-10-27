import { QueryClient } from '@tanstack/react-query'

// Every test builds its QueryClient here, with the defaults TanStack Query's testing guide gives. A failed query
// fails at once instead of retrying three times with backoff. And gcTime Infinity schedules no garbage-collection
// timer: once a test unmounts, a query or mutation left without an observer would otherwise start a real five-minute
// setTimeout, and Jest's worker waits on it until it is force-exited.
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  })
}
