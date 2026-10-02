import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { prependProperty, readJsonc, removeWhatBaseDeclares, setJsonc } from './jsonc.ts'
import { applyMcp } from './mcp.ts'

export type AppType = 'api' | 'web' | 'mobile' | 'site'

const CLIENTS: AppType[] = ['web', 'mobile']

// One exception to one-version-per-dependency: stable NativeWind needs Tailwind 3.
const NAMED_CATALOGS = [{ name: 'tailwind3', dependency: 'tailwindcss', major: '3' }]

export type Catalogs = { default: Dependencies; named: Record<string, Dependencies> }

type Dependencies = Record<string, string>

type PackageJson = {
  scripts?: Record<string, string>
  dependencies?: Dependencies
  devDependencies?: Dependencies
}

const NOT_COPIED = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.env',
  'pnpm-lock.yaml',
  '.expo',
  '.next',
])

const NOT_COPIED_SUFFIXES = ['.tsbuildinfo']

// The name inside the package, and the name it is restored to. npm deletes a dotted .gitignore from a tarball.
const PACKAGED_AS = { gitignore: '.gitignore' }

const CONTRACT_IMPORT = "'@/api-contract'"
const CONTRACT_PACKAGE = '@app/api-contract'

function dependencySections(pkg: PackageJson): Dependencies[] {
  return [pkg.dependencies, pkg.devDependencies].filter((section) => section !== undefined)
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true, recursive: true })

  return entries
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
}

async function rewriteText(path: string, change: (text: string) => string): Promise<void> {
  await writeFile(path, change(await readFile(path, 'utf8')))
}

export async function copyTemplate(source: string, destination: string): Promise<void> {
  await cp(source, destination, {
    recursive: true,
    filter: (path) =>
      !relative(source, path)
        .split(sep)
        .some(
          (part) =>
            NOT_COPIED.has(part) || NOT_COPIED_SUFFIXES.some((suffix) => part.endsWith(suffix)),
        ),
  })

  // Published, a template's .gitignore is `gitignore`, because npm deletes the dotted name from a tarball.
  for (const [packaged, restored] of Object.entries(PACKAGED_AS)) {
    if (existsSync(join(destination, packaged))) {
      await rename(join(destination, packaged), join(destination, restored))
    }
  }
}

async function copyApp(templates: string, target: string, type: AppType): Promise<string> {
  const destination = join(target, 'apps', type)

  await copyTemplate(join(templates, type), destination)
  await rm(join(destination, '.githooks'), { recursive: true, force: true })

  return destination
}

async function contractFiles(directory: string): Promise<Map<string, string>> {
  const files = new Map<string, string>()

  for (const file of await sourceFiles(directory)) {
    files.set(relative(directory, file), await readFile(file, 'utf8'))
  }

  return files
}

async function extractContract(target: string, clients: AppType[]): Promise<void> {
  const [first, ...others] = clients.map((client) => join(target, 'apps', client))

  if (first === undefined) {
    return
  }

  const expected = await contractFiles(join(first, 'src', 'api-contract'))

  for (const other of others) {
    const actual = await contractFiles(join(other, 'src', 'api-contract'))
    const differs =
      actual.size !== expected.size ||
      [...expected].some(([file, text]) => actual.get(file) !== text)

    if (differs) {
      throw new Error(
        `${relative(target, other)}/src/api-contract differs from ${relative(target, first)}'s`,
      )
    }

    await rm(join(other, 'src', 'api-contract'), { recursive: true })
  }

  await rename(join(first, 'src', 'api-contract'), join(target, 'packages', 'api-contract', 'src'))

  for (const client of [first, ...others]) {
    for (const directory of ['src', 'test']) {
      for (const file of await sourceFiles(join(client, directory)).catch(() => [])) {
        await rewriteText(file, (text) => text.replaceAll(CONTRACT_IMPORT, `'${CONTRACT_PACKAGE}'`))
      }
    }

    await rewriteText(join(client, 'package.json'), (text) =>
      setJsonc(text, ['dependencies', CONTRACT_PACKAGE], 'workspace:*'),
    )
  }
}

function namedCatalogFor(dependency: string, version: string): string | undefined {
  return NAMED_CATALOGS.find(
    (entry) => entry.dependency === dependency && version.split('.')[0] === entry.major,
  )?.name
}

export function collectCatalog(packages: PackageJson[]): Catalogs {
  const catalogs: Catalogs = { default: {}, named: {} }

  for (const pkg of packages) {
    for (const section of dependencySections(pkg)) {
      for (const [name, version] of Object.entries(section)) {
        if (version.startsWith('workspace:') || version === 'catalog:') {
          continue
        }

        const named = namedCatalogFor(name, version)
        if (named !== undefined) {
          catalogs.named[named] ??= {}
        }

        const catalog =
          named === undefined ? catalogs.default : (catalogs.named[named] as Dependencies)
        const existing = catalog[name]

        if (existing !== undefined && existing !== version) {
          throw new Error(
            `${name} is pinned to both ${existing} and ${version}; a catalog holds one version`,
          )
        }

        catalog[name] = version
      }
    }
  }

  return catalogs
}

async function adaptAppConfig(target: string, app: string): Promise<void> {
  const packagePath = join(app, 'package.json')
  let pkg = await readFile(packagePath, 'utf8')
  const parsed = readJsonc<PackageJson>(pkg)

  pkg = setJsonc(pkg, ['scripts', 'prepare'], undefined)

  for (const section of ['dependencies', 'devDependencies'] as const) {
    for (const [name, version] of Object.entries(parsed[section] ?? {})) {
      if (!version.startsWith('workspace:')) {
        const named = namedCatalogFor(name, version)

        pkg = setJsonc(pkg, [section, name], named === undefined ? 'catalog:' : `catalog:${named}`)
      }
    }
  }

  await writeFile(packagePath, pkg)

  const tsconfigPath = join(app, 'tsconfig.json')
  const base = await readFile(join(target, 'tsconfig.base.json'), 'utf8')
  let tsconfig = removeWhatBaseDeclares(await readFile(tsconfigPath, 'utf8'), base)
  const inherited = readJsonc<{ extends?: string }>(tsconfig).extends

  if (inherited === undefined) {
    tsconfig = prependProperty(tsconfig, 'extends', '../../tsconfig.base.json')
  } else {
    tsconfig = setJsonc(tsconfig, ['extends'], ['../../tsconfig.base.json', inherited])
  }

  await writeFile(tsconfigPath, tsconfig)

  const biomePath = join(app, 'biome.jsonc')
  const rootBiome = await readFile(join(target, 'biome.jsonc'), 'utf8')
  const biome = removeWhatBaseDeclares(await readFile(biomePath, 'utf8'), rootBiome)

  await writeFile(biomePath, prependProperty(biome, 'extends', '//'))
}

async function takeBuildApprovals(app: string): Promise<string[]> {
  const path = join(app, 'pnpm-workspace.yaml')
  const text = await readFile(path, 'utf8').catch(() => undefined)

  if (text === undefined) {
    return []
  }

  await rm(path)

  const lines = text.split('\n')
  const start = lines.indexOf('allowBuilds:')

  if (start === -1) {
    throw new Error(
      `${path} holds settings other than allowBuilds, which composition does not merge`,
    )
  }

  return lines.slice(start + 1).filter((line) => line.startsWith('  '))
}

function entriesYaml(catalog: Dependencies, indent: string): string {
  return Object.keys(catalog)
    .sort()
    .map((name) => `${indent}'${name}': ${catalog[name]}`)
    .join('\n')
}

function catalogYaml(catalogs: Catalogs): string {
  const named = Object.entries(catalogs.named)
    .map(([name, catalog]) => `  ${name}:\n${entriesYaml(catalog, '    ')}`)
    .join('\n')

  return `\ncatalog:\n${entriesYaml(catalogs.default, '  ')}\n${named === '' ? '' : `\ncatalogs:\n${named}\n`}`
}

async function assertCatalogCovers(target: string, catalog: Dependencies): Promise<void> {
  const manifests = [
    join(target, 'package.json'),
    join(target, 'packages', 'api-contract', 'package.json'),
  ]

  for (const manifest of manifests) {
    const pkg = readJsonc<PackageJson>(await readFile(manifest, 'utf8'))

    for (const section of dependencySections(pkg)) {
      for (const [name, version] of Object.entries(section)) {
        if (version === 'catalog:' && catalog[name] === undefined) {
          throw new Error(
            `${relative(target, manifest)} needs ${name} from the catalog, and no app pins it`,
          )
        }
      }
    }
  }
}

export async function composeWorkspace({
  templates,
  target,
  types,
  mobileScheme = 'app',
  mcp = false,
}: {
  templates: string
  target: string
  types: AppType[]
  mobileScheme?: string
  mcp?: boolean
}): Promise<void> {
  await mkdir(target, { recursive: true })
  await copyTemplate(join(templates, 'workspace'), target)

  const apps: string[] = []

  for (const type of types) {
    const app = await copyApp(templates, target, type)

    // Before the catalog is collected, so a dependency that leaves never reaches it.
    await applyMcp(app, type, mcp)
    apps.push(app)
  }

  const clients = CLIENTS.filter((client) => types.includes(client))

  if (clients.length > 0) {
    await extractContract(target, clients)
  } else {
    await rm(join(target, 'packages'), { recursive: true, force: true })
  }

  if (types.includes('api') && types.includes('mobile')) {
    await rewriteText(join(target, 'apps', 'api', '.env.example'), (text) => {
      if (!text.includes('# MOBILE_APP_SCHEME=app\n')) {
        throw new Error(
          'apps/api/.env.example no longer carries the commented MOBILE_APP_SCHEME line',
        )
      }
      return text.replace('# MOBILE_APP_SCHEME=app\n', `MOBILE_APP_SCHEME=${mobileScheme}\n`)
    })
  }

  // One command for everything and one per app. Each app answers to `dev`, so the root never needs to know how.
  // The database and the ports are the exception: both may ask a question, which the interleaved output of a
  // parallel run would bury, so the root asks first and each app's own check then finds nothing to do.
  // `pnpm -r --parallel` starts each app in its own process group, so Ctrl+C reaches pnpm and leaves the apps
  // running. The ports script wraps the run, remembers what it started, and stops all of it on the way out.
  const database = types.includes('api') ? 'node apps/api/scripts/database.mjs --check && ' : ''
  const dev = `${database}node scripts/ports.mjs --all -- pnpm -r --parallel dev`

  await rewriteText(join(target, 'package.json'), (text) =>
    types.reduce(
      (pkg, type) => setJsonc(pkg, ['scripts', type], `pnpm --filter ${type} dev`),
      setJsonc(text, ['scripts', 'dev'], dev),
    ),
  )

  const manifests = await Promise.all(
    apps.map(async (app) =>
      readJsonc<PackageJson>(await readFile(join(app, 'package.json'), 'utf8')),
    ),
  )
  const catalogs = collectCatalog(manifests)

  if (clients.length > 0) {
    await assertCatalogCovers(target, catalogs.default)
  }

  const approvals: string[] = []

  for (const app of apps) {
    await adaptAppConfig(target, app)

    for (const line of await takeBuildApprovals(app)) {
      if (!approvals.includes(line)) {
        approvals.push(line)
      }
    }
  }

  const builds = approvals.length > 0 ? `\nallowBuilds:\n${approvals.join('\n')}\n` : ''

  await rewriteText(
    join(target, 'pnpm-workspace.yaml'),
    (text) => text + catalogYaml(catalogs) + builds,
  )
}
