import type { TokenStore, Tokens } from '@/api-contract'

// expo-secure-store needs the native Keychain or Keystore, which Jest does not have.
export function memoryTokenStore(initial: Tokens | null = null): TokenStore {
  let current = initial

  return {
    async read() {
      return current
    },
    async write(tokens) {
      current = tokens
    },
  }
}
