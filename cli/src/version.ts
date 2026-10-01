import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** This CLI's own version. src/*.ts and dist/*.js both sit one level below package.json. */
export function cliVersion(): string {
  const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'))

  return pkg.version as string
}
