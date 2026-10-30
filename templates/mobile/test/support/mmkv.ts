// MMKV is native, and Jest has none of it: a test keeps what the app stores in memory instead, one store per id.
jest.mock('react-native-mmkv', () => {
  const stores = new Map<string, Map<string, string>>()

  return {
    createMMKV: ({ id }: { id: string }) => {
      const data = stores.get(id) ?? new Map<string, string>()

      stores.set(id, data)

      return {
        getString: (key: string) => data.get(key),
        set: (key: string, value: string | number | boolean) => data.set(key, String(value)),
        remove: (key: string) => data.delete(key),
        clearAll: () => data.clear(),
      }
    },
  }
})
