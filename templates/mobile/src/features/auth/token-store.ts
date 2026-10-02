import * as SecureStore from 'expo-secure-store'
import type { TokenStore, Tokens } from '@/api-contract'

const KEY = 'auth.tokens'

// The Keychain on iOS and the Keystore on Android: the tokens never sit in plain storage, MMKV included.
export const secureTokenStore: TokenStore = {
  async read() {
    const value = await SecureStore.getItemAsync(KEY)

    return value === null ? null : (JSON.parse(value) as Tokens)
  },

  async write(tokens) {
    if (tokens === null) {
      await SecureStore.deleteItemAsync(KEY)
    } else {
      await SecureStore.setItemAsync(KEY, JSON.stringify(tokens))
    }
  },
}
