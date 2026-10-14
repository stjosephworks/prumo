import { describe, expect, it } from 'vitest'
import { runCommand } from '../src/command.ts'

describe('runCommand', () => {
  // pnpm stands in for every tool the CLI runs: on Windows it is a .cmd shim, the case a shell is needed for.
  it('runs a tool by name and hands back its output', () => {
    const result = runCommand('pnpm', ['--version'], { encoding: 'utf8' })

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(String(result.stdout).trim()).toMatch(/^\d+\.\d+\.\d+/)
  })

  it.runIf(process.platform === 'win32')('refuses an argument a shell would split', () => {
    expect(() => runCommand('pnpm', ['a b'])).toThrow('cannot be passed through a shell')
  })
})
