module.exports = {
  preset: 'jest-expo',
  setupFiles: [
    '<rootDir>/test/support/localization.ts', // prumo:multi-language
    '<rootDir>/test/support/mmkv.ts',
    '<rootDir>/test/support/google-sign-in.ts', // prumo:google
  ],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1', '^@test/(.*)$': '<rootDir>/test/$1' },
  // A first render brings React Native and Babel's transform with it, which costs seconds on a cold cache: inside a
  // workspace the contract is a package to transform too, and Jest's 5s default was crossed in CI while the same
  // suite passed alone. The budget is the machine's slowness, not the test's.
  testTimeout: 30_000,
}
