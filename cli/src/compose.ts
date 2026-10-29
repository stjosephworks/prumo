import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { type App, appsOfType, PORTS, portOf, templateOf } from './apps.ts'
import { applyFeatures, cutFeatures, type Enabled, NONE } from './features.ts'
import { prependProperty, readJsonc, removeWhatBaseDeclares, setJsonc } from './jsonc.ts'
import { applyLanguages, LANGUAGES, type Language } from './languages.ts'

export type AppType = 'api' | 'web' | 'mobile'

export const CLIENTS: AppType[] = ['web', 'mobile']

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

const BRANCHES_SECTION = /^## Branches\n[\s\S]*?(?=^## )/m

// The root's `dev` sets the API's database up first, in whichever directory the API was given.
export function rootDevPrefix(api: string): string {
  return `node apps/${api}/scripts/database.mjs --check && `
}

const CONTRACT_IMPORT = "'@/api-contract'"
const CONTRACT_PACKAGE = '@app/api-contract'

// Where an app keeps the project's languages, and the package they move to in a workspace.
const LOCALES_FILE = join('src', 'i18n', 'locales.ts')
const I18N_IMPORT = "'@/i18n/locales'"
const I18N_PACKAGE = '@app/i18n'

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

export async function copyApp(templates: string, target: string, app: App): Promise<string> {
  const destination = join(target, 'apps', app.name)

  await copyTemplate(join(templates, templateOf(app)), destination)

  // The package is the app's name, which the root's `pnpm --filter <name>` finds it by.
  await rewriteText(join(destination, 'package.json'), (text) => setJsonc(text, ['name'], app.name))

  // The workspace root carries these, for every app below it, and its README says how to set the branches up.
  for (const rootOnly of ['.githooks', '.gitattributes', '.github']) {
    await rm(join(destination, rootOnly), { recursive: true, force: true })
  }
  await rewriteText(join(destination, 'README.md'), (text) => {
    if (!BRANCHES_SECTION.test(text)) {
      throw new Error(`${join(destination, 'README.md')} no longer carries a Branches section`)
    }
    return text.replace(BRANCHES_SECTION, '')
  })

  return destination
}

async function contractFiles(directory: string): Promise<Map<string, string>> {
  const files = new Map<string, string>()

  for (const file of await sourceFiles(directory)) {
    files.set(relative(directory, file), await readFile(file, 'utf8'))
  }

  return files
}

export async function extractContract(target: string, clients: App[]): Promise<void> {
  const [first, ...others] = clients.map((client) => join(target, 'apps', client.name))

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
    await importContract(client)
  }
}

// A client of the workspace imports the contract from its package rather than from a copy of its own.
async function importContract(client: string): Promise<void> {
  for (const directory of ['src', 'test']) {
    for (const file of await sourceFiles(join(client, directory)).catch(() => [])) {
      await rewriteText(file, (text) => text.replaceAll(CONTRACT_IMPORT, `'${CONTRACT_PACKAGE}'`))
    }
  }

  await rewriteText(join(client, 'package.json'), (text) =>
    setJsonc(text, ['dependencies', CONTRACT_PACKAGE], 'workspace:*'),
  )
}

// A client added to a workspace that already shares a contract takes the team's, which may have grown since, and
// drops the template's copy.
export async function joinContract(client: string): Promise<void> {
  await rm(join(client, 'src', 'api-contract'), { recursive: true })
  await importContract(client)
}

// The languages are one list for the whole workspace, so every app imports them from one package, the API too: it
// loads the package's TypeScript at runtime, through Node's own type stripping (.prumo/i18n/languages.md).
export async function extractI18n(target: string, apps: App[]): Promise<void> {
  const speaking = apps
    .map((app) => join(target, 'apps', app.name))
    .filter((app) => existsSync(join(app, LOCALES_FILE)))
  const [first, ...others] = speaking
  const i18n = join(target, 'packages', 'i18n')

  if (first === undefined) {
    await rm(i18n, { recursive: true, force: true })
    return
  }

  const expected = await readFile(join(first, LOCALES_FILE), 'utf8')

  for (const other of others) {
    if ((await readFile(join(other, LOCALES_FILE), 'utf8')) !== expected) {
      throw new Error(
        `${relative(target, other)}/${LOCALES_FILE} differs from ${relative(target, first)}'s`,
      )
    }

    await rm(join(other, LOCALES_FILE))
  }

  await mkdir(join(i18n, 'src'), { recursive: true })
  await rename(join(first, LOCALES_FILE), join(i18n, 'src', 'index.ts'))

  for (const app of speaking) {
    await importI18n(app)
  }
}

async function importI18n(app: string): Promise<void> {
  for (const directory of ['src', 'test']) {
    for (const file of await sourceFiles(join(app, directory)).catch(() => [])) {
      await rewriteText(file, (text) => text.replaceAll(I18N_IMPORT, `'${I18N_PACKAGE}'`))
    }
  }

  await rewriteText(join(app, 'package.json'), (text) =>
    setJsonc(text, ['dependencies', I18N_PACKAGE], 'workspace:*'),
  )
}

// An app added to a workspace speaks its languages from its package, and drops the template's copy.
export async function joinI18n(app: string): Promise<void> {
  if (existsSync(join(app, LOCALES_FILE))) {
    await rm(join(app, LOCALES_FILE))
    await importI18n(app)
  }
}

function setEnvLine(text: string, key: string, value: string, file: string): string {
  const line = new RegExp(`^${key}=.*$`, 'm')

  if (!line.test(text)) {
    throw new Error(`${file} no longer carries a ${key} line`)
  }

  return text.replace(line, `${key}=${value}`)
}

// A second app of a template takes the next port, written where the template wrote the first, and the API trusts
// every web app, the first one first.
async function placePorts(target: string, apps: App[]): Promise<void> {
  for (const app of apps) {
    const { key, from } = PORTS[templateOf(app)]
    const port = portOf(apps, app)
    const directory = join(target, 'apps', app.name)

    if (port === from) {
      continue
    }

    const example = join(directory, '.env.example')
    await rewriteText(example, (text) => setEnvLine(text, key, String(port), example))

    if (templateOf(app) === 'web-next') {
      await rewriteText(join(directory, 'package.json'), (text) => {
        const start = readJsonc<PackageJson>(text).scripts?.start ?? ''

        if (!start.includes(`--port ${from}`)) {
          throw new Error(`${join(directory, 'package.json')} no longer starts on --port ${from}`)
        }

        return setJsonc(
          text,
          ['scripts', 'start'],
          start.replace(`--port ${from}`, `--port ${port}`),
        )
      })
    }
  }

  const [api] = appsOfType(apps, 'api')
  const webs = appsOfType(apps, 'web')

  // The template trusts Vite's first port; any other first web, or a second, rewrites the list.
  if (api !== undefined && webs.length > 0) {
    const example = join(target, 'apps', api.name, '.env.example')
    const origins = webs.map((web) => `http://localhost:${portOf(apps, web)}`).join(',')

    await rewriteText(example, (text) => setEnvLine(text, 'WEB_ORIGIN', origins, example))
  }
}

export function namedCatalogFor(dependency: string, version: string): string | undefined {
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

export async function adaptAppConfig(target: string, app: string): Promise<void> {
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

export async function takeBuildApprovals(app: string): Promise<string[]> {
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
    join(target, 'packages', 'i18n', 'package.json'),
  ]

  for (const manifest of manifests.filter((path) => existsSync(path))) {
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
  apps,
  features = NONE,
  languages = [...LANGUAGES],
}: {
  templates: string
  target: string
  apps: App[]
  features?: Enabled
  // The project's languages, its base first; a template as it is speaks all of Prumo's, English first.
  languages?: Language[]
}): Promise<void> {
  await mkdir(target, { recursive: true })
  await copyTemplate(join(templates, 'workspace'), target)

  // The root README tells a first run what the features change, so it is cut like any app's.
  // It also points into the API's directory, which may have been given a name of its own.
  const readme = join(target, 'README.md')
  const [api] = appsOfType(apps, 'api')
  const cut = cutFeatures(await readFile(readme, 'utf8'), features, readme)
  await writeFile(readme, cut.replaceAll('apps/api/', `apps/${api?.name ?? 'api'}/`))

  const directories: string[] = []

  for (const app of apps) {
    const directory = await copyApp(templates, target, app)

    // Before the catalog is collected, so a dependency that leaves never reaches it.
    await applyFeatures(directory, templateOf(app), features)
    await applyLanguages(directory, languages)
    directories.push(directory)
  }

  await placePorts(target, apps)

  const clients = apps.filter((app) => CLIENTS.includes(app.type))

  if (clients.length > 0) {
    await extractContract(target, clients)
  } else {
    await rm(join(target, 'packages', 'api-contract'), { recursive: true, force: true })
  }

  await extractI18n(target, apps)

  // One command for everything and one per app. Each app answers to `dev`, so the root never needs to know how.
  // The database and the ports are the exception: both may ask a question, which the interleaved output of a
  // parallel run would bury, so the root asks first and each app's own check then finds nothing to do.
  // `pnpm -r --parallel` starts each app in its own process group, so Ctrl+C reaches pnpm and leaves the apps
  // running. The ports script wraps the run, remembers what it started, and stops all of it on the way out.
  const database = api === undefined ? '' : rootDevPrefix(api.name)
  const dev = `${database}node scripts/ports.mjs --all -- pnpm -r --parallel dev`

  await rewriteText(join(target, 'package.json'), (text) =>
    apps.reduce(
      (pkg, app) => setJsonc(pkg, ['scripts', app.name], `pnpm --filter ${app.name} dev`),
      setJsonc(text, ['scripts', 'dev'], dev),
    ),
  )

  const manifests = await Promise.all(
    directories.map(async (app) =>
      readJsonc<PackageJson>(await readFile(join(app, 'package.json'), 'utf8')),
    ),
  )
  const catalogs = collectCatalog(manifests)

  await assertCatalogCovers(target, catalogs.default)

  const approvals: string[] = []

  for (const directory of directories) {
    await adaptAppConfig(target, directory)

    for (const line of await takeBuildApprovals(directory)) {
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
