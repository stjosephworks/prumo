const preset = require('jest-expo/jest-preset')

const [nodeModules, ...rest] = preset.transformIgnorePatterns
const babel = preset.transform['\\.[jt]sx?$']

if (!nodeModules.includes('(?!(') || babel === undefined) {
  throw new Error(
    'jest-expo changed its transform settings; re-check the Better Auth entries below',
  )
}

module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1', '^@test/(.*)$': '<rootDir>/test/$1' },
  // A first render brings React Native and Babel's transform with it, which costs seconds on a cold cache: inside a
  // workspace the contract is a package to transform too, and Jest's 5s default was crossed in CI while the same
  // suite passed alone. The budget is the machine's slowness, not the test's.
  testTimeout: 30_000,
  // Better Auth ships ESM only, partly as .mjs, so it joins the packages jest-expo transforms, with the same Babel.
  transform: { '\\.mjs$': babel },
  transformIgnorePatterns: [
    nodeModules.replace('(?!(', '(?!(better-auth|@better-auth|nanostores|'),
    ...rest,
  ],
}
