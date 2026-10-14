import { type SpawnSyncOptions, type SpawnSyncReturns, spawnSync } from 'node:child_process'

const windows = process.platform === 'win32'

// Only what the CLI itself writes: no space, quote or shell operator, so one line means the same in any shell.
const PLAIN = /^[\w@.:/={}-]+$/

// Runs a tool the CLI names, such as pnpm, git or docker. On Windows pnpm is a .cmd shim, which Node starts only
// through a shell, and a shell given an argument list is deprecated (DEP0190), so there the command goes as one line.
export function runCommand(
  command: string,
  args: string[],
  options: SpawnSyncOptions = {},
): SpawnSyncReturns<string | Buffer> {
  if (!windows) {
    return spawnSync(command, args, options)
  }

  for (const part of [command, ...args]) {
    if (!PLAIN.test(part)) {
      throw new Error(`${part} cannot be passed through a shell unquoted`)
    }
  }

  return spawnSync([command, ...args].join(' '), { ...options, shell: true })
}
