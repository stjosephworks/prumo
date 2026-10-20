import { relative } from 'node:path'
import { type App, appsOfType, defaultApps } from './apps.ts'
import type { AppType } from './compose.ts'

// What to type after `prumo new`, built from the scripts the templates ship rather than written per case. Every app
// and every workspace root answers to `pnpm dev`; an API's `dev` first offers to create the database, and a mobile
// app opens only in a development build, which its `ios` and `android` scripts make.
export function nextSteps({
  target,
  cwd,
  types,
  apps = defaultApps(types),
  architecture,
  installed,
}: {
  target: string
  cwd: string
  types: AppType[]
  apps?: App[]
  architecture: 'alone' | 'monorepo'
  installed: boolean
}): string[] {
  const steps: [string, string?][] = []
  const directory = relative(cwd, target)

  if (directory !== '') {
    steps.push([`cd ${/\s/.test(directory) ? `"${directory}"` : directory}`])
  }

  if (!installed) {
    steps.push(['pnpm install'])
  }

  for (const mobile of appsOfType(apps, 'mobile')) {
    const run = architecture === 'alone' ? 'pnpm' : `pnpm --filter ${mobile.name}`

    steps.push([`${run} ios`, 'or android: the development build the mobile app opens in'])
  }

  steps.push([
    'pnpm dev',
    types.includes('api') ? 'offers to create the database first' : undefined,
  ])

  const width = Math.max(...steps.map(([command]) => command.length))

  return steps.map(([command, why]) =>
    why === undefined ? command : `${command.padEnd(width)}  # ${why}`,
  )
}
