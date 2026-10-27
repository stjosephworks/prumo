import { join } from 'node:path'
import type { AppType } from './compose.ts'
import { CliError } from './output.ts'

// What a web app is built with. Absent on an app read from a config written before frameworks, which was Vite's.
export type WebFramework = 'vite' | 'next' | 'astro'

export const WEB_FRAMEWORKS: WebFramework[] = ['vite', 'next', 'astro']

// An app of a workspace: the directory under apps/, the package and the root script are all its name. By default it
// is named after its type; an advanced answer renames it, or adds another web beside the first. Only a web app has a
// framework, and until it is asked or defaulted it may have none.
export type App = { name: string; type: AppType; framework?: WebFramework }

// The directory under templates/ an app is copied from, and the key of everything that differs by it.
export type Template = 'api' | 'mobile' | 'web-vite' | 'web-next' | 'web-astro'

export function templateOf(app: { type: AppType; framework?: WebFramework }): Template {
  return app.type === 'web' ? `web-${app.framework ?? 'vite'}` : app.type
}

export const TYPES: AppType[] = ['api', 'web', 'mobile']

// A second api would need its own database, contract and clients to point at it, and a second mobile app its own
// scheme for the API to send it back to; neither is offered.
export const REPEATABLE: AppType[] = ['web']

const APP_NAME = /^[a-z][a-z0-9-]*$/

// The workspace root's own scripts, which an app's script of the same name would overwrite.
export const ROOT_SCRIPTS = ['dev', 'lint', 'typecheck', 'test', 'prepare']

// `pnpm <name>` runs the root script only when pnpm has no command of that name. The commands and aliases of pnpm
// 10.26, the floor, and of 12.3.
const PNPM_COMMANDS = [
  't',
  'access',
  'init',
  'recursive',
  'multi',
  'm',
  'add',
  'install',
  'i',
  'install-test',
  'it',
  'update',
  'up',
  'upgrade',
  'outdated',
  'audit',
  'change',
  'version',
  'lane',
  'bugs',
  'issues',
  'list',
  'ls',
  'll',
  'la',
  'licenses',
  'licences',
  'why',
  'view',
  'info',
  'show',
  'v',
  'sbom',
  'whoami',
  'deprecate',
  'undeprecate',
  'unpublish',
  'star',
  'unstar',
  'stars',
  'dist-tag',
  'dist-tags',
  'ping',
  'doctor',
  'search',
  's',
  'se',
  'find',
  'rebuild',
  'rb',
  'pack',
  'publish',
  'stage',
  'remove',
  'uninstall',
  'rm',
  'un',
  'uni',
  'patch',
  'patch-commit',
  'patch-remove',
  'peers',
  'set-script',
  'ss',
  'run',
  'exec',
  'dlx',
  'create',
  'completion',
  'start',
  'stop',
  'restart',
  'find-hash',
  'runtime',
  'rt',
  'env',
  'shim',
  'bin',
  'clean',
  'purge',
  'ci',
  'clean-install',
  'ic',
  'install-clean',
  'root',
  'prefix',
  'config',
  'c',
  'get',
  'set',
  'pkg',
  'pack-app',
  'store',
  'cache',
  'cat-file',
  'cat-index',
  'ignored-builds',
  'approve-builds',
  'link',
  'ln',
  'import',
  'dedupe',
  'deploy',
  'prune',
  'fetch',
  'unlink',
  'dislink',
  'docs',
  'home',
  'repo',
  'self-update',
  'setup',
  'login',
  'adduser',
  'team',
  'owner',
  'owners',
  'logout',
  'with',
  'edit',
  'profile',
  'token',
  'xmas',
  'help',
]

export const RESERVED_APP_NAMES = [...ROOT_SCRIPTS, ...PNPM_COMMANDS]

// Where an app keeps its port and the first one it takes; a second app of the same template takes the next. Every web
// app keeps it under one key, each framework starting from its own default.
export const PORTS: Record<Template, { key: string; from: number }> = {
  api: { key: 'PORT', from: 3000 },
  'web-vite': { key: 'WEB_PORT', from: 5173 },
  'web-next': { key: 'WEB_PORT', from: 3200 },
  'web-astro': { key: 'WEB_PORT', from: 4321 },
  mobile: { key: 'METRO_PORT', from: 8081 },
}

// Where a client reads the API's address, which each bundler exposes to the browser under its own prefix.
export const API_URL_KEYS: Partial<Record<Template, string>> = {
  'web-vite': 'VITE_API_URL',
  'web-next': 'NEXT_PUBLIC_API_URL',
  'web-astro': 'PUBLIC_API_URL',
  mobile: 'EXPO_PUBLIC_API_URL',
}

// A type as `--types` and `--app` write it: `web`, or `web:next` to choose its framework.
export type TypeEntry = { type: AppType; framework?: WebFramework }

export function parseTypeEntry(value: string, where: string, code = 'invalid_input'): TypeEntry {
  const [type = '', framework, ...rest] = value.split(':').map((part) => part.trim())

  if (type === 'site') {
    throw new CliError(
      code,
      `${where}: site became web:next, a web app built with Next. Write web:next.`,
    )
  }

  if (!TYPES.includes(type as AppType)) {
    throw new CliError(
      code,
      `${where}: unknown type ${type || '(none)'}. Choose from ${TYPES.join(', ')}.`,
    )
  }

  if (framework === undefined && rest.length === 0) {
    return { type: type as AppType }
  }

  if (type !== 'web' || rest.length > 0 || !WEB_FRAMEWORKS.includes(framework as WebFramework)) {
    throw new CliError(
      code,
      `${where}: only web takes a framework, one of ${WEB_FRAMEWORKS.map((each) => `web:${each}`).join(', ')}; got "${value}".`,
    )
  }

  return { type: 'web', framework: framework as WebFramework }
}

export function defaultApps(entries: (AppType | TypeEntry)[]): App[] {
  return entries.map((entry) => {
    const { type, framework } = typeof entry === 'string' ? { type: entry } : entry

    return framework === undefined ? { name: type, type } : { name: type, type, framework }
  })
}

export function typesOf(apps: App[]): AppType[] {
  return [...new Set(apps.map((app) => app.type))]
}

export function appsOfType(apps: App[], type: AppType): App[] {
  return apps.filter((app) => app.type === type)
}

// `name=type`, as `--app backoffice=web` or `--app blog=web:next` writes it.
export function parseApp(value: string): App {
  const [name = '', type = '', ...rest] = value.split('=').map((part) => part.trim())

  if (rest.length > 0 || name === '' || type === '') {
    throw new CliError(
      'invalid_app',
      `--app takes <name>=<type>, as in backoffice=web or blog=web:next; got "${value}".`,
    )
  }

  const [app] = defaultApps([parseTypeEntry(type, `--app ${value}`, 'invalid_app')])

  return { ...(app as App), name }
}

// Why a name cannot name an app beside the others, or undefined when it can.
export function appNameProblem(name: string, others: App[], project: string): string | undefined {
  if (!APP_NAME.test(name)) {
    return 'Use lowercase letters, digits and hyphens, starting with a letter.'
  }

  if (RESERVED_APP_NAMES.includes(name)) {
    return `"${name}" is a pnpm command or a root script, so \`pnpm ${name}\` would never start the app.`
  }

  if (name === project) {
    return 'That is the project’s name, which its root package already takes.'
  }

  if (others.some((other) => other.name === name)) {
    return `Another app is already named "${name}".`
  }

  return undefined
}

export function validateApps(apps: App[], project: string): void {
  apps.forEach((app, index) => {
    const problem = appNameProblem(app.name, apps.slice(0, index), project)

    if (problem !== undefined) {
      throw new CliError('invalid_app', `Invalid app name "${app.name}". ${problem}`)
    }
  })

  for (const type of TYPES.filter((each) => !REPEATABLE.includes(each))) {
    if (appsOfType(apps, type).length > 1) {
      throw new CliError(
        'invalid_app',
        `A workspace holds one ${type}; only ${REPEATABLE.join(' and ')} may repeat.`,
      )
    }
  }
}

// Each app's port: its template's first, then the next for each further app of that template.
export function portOf(apps: App[], app: App): number {
  const template = templateOf(app)

  return PORTS[template].from + apps.filter((each) => templateOf(each) === template).indexOf(app)
}

export function appDirectory(root: string, architecture: 'alone' | 'monorepo', app: App): string {
  return architecture === 'alone' ? root : join(root, 'apps', app.name)
}

// The apps a project's config describes. One written before apps had names holds one app per type, named after it.
export function appsOf(config: { types: AppType[]; apps?: App[] }): App[] {
  return config.apps ?? defaultApps(config.types)
}
