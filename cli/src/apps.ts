import { join } from 'node:path'
import type { AppType } from './compose.ts'
import { CliError } from './output.ts'

// An app of a workspace: the directory under apps/, the package and the root script are all its name. By default it
// is named after its type; an advanced answer renames it, or adds another web or site beside the first.
export type App = { name: string; type: AppType }

export const TYPES: AppType[] = ['api', 'web', 'mobile', 'site']

// A second api would need its own database, contract and clients to point at it, and a second mobile app its own
// scheme for the API to send it back to; neither is offered.
export const REPEATABLE: AppType[] = ['web', 'site']

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

// Where an app of a type keeps its port and the first one it takes; a second app of the type takes the next.
export const PORTS: Record<AppType, { key: string; from: number }> = {
  api: { key: 'PORT', from: 3000 },
  web: { key: 'WEB_PORT', from: 5173 },
  site: { key: 'SITE_PORT', from: 3200 },
  mobile: { key: 'METRO_PORT', from: 8081 },
}

export function defaultApps(types: AppType[]): App[] {
  return types.map((type) => ({ name: type, type }))
}

export function typesOf(apps: App[]): AppType[] {
  return [...new Set(apps.map((app) => app.type))]
}

export function appsOfType(apps: App[], type: AppType): App[] {
  return apps.filter((app) => app.type === type)
}

// `name=type`, as `--app backoffice=web` writes it.
export function parseApp(value: string): App {
  const [name = '', type = '', ...rest] = value.split('=').map((part) => part.trim())

  if (rest.length > 0 || name === '' || type === '') {
    throw new CliError(
      'invalid_app',
      `--app takes <name>=<type>, as in backoffice=web; got "${value}".`,
    )
  }

  if (!TYPES.includes(type as AppType)) {
    throw new CliError(
      'invalid_app',
      `Unknown type in --app ${value}: ${type}. Choose from ${TYPES.join(', ')}.`,
    )
  }

  return { name, type: type as AppType }
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

// Each app's port: the type's first, then the next for each further app of that type.
export function portOf(apps: App[], app: App): number {
  return PORTS[app.type].from + appsOfType(apps, app.type).indexOf(app)
}

export function appDirectory(root: string, architecture: 'alone' | 'monorepo', app: App): string {
  return architecture === 'alone' ? root : join(root, 'apps', app.name)
}

// The apps a project's config describes. One written before apps had names holds one app per type, named after it.
export function appsOf(config: { types: AppType[]; apps?: App[] }): App[] {
  return config.apps ?? defaultApps(config.types)
}
