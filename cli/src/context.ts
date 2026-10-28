import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type App, appsOf, templateOf } from './apps.ts'
import type { AppType } from './compose.ts'
import { cutFeatures, enabledFor, type SignInMethod, type SocialProvider } from './features.ts'
import { cliVersion } from './version.ts'

export type Answers = {
  name: string
  types: AppType[]
  // Absent, the apps are one per type, named after it: what every project held before apps had names.
  apps?: App[]
  architecture: 'alone' | 'monorepo'
  multiTenant: boolean
  mcp: boolean
  // How a person signs in; from 0.9.0. Before it, a password and only that.
  signIn: SignInMethod[]
  email: boolean
  social: SocialProvider[]
}

const CLIENTS: AppType[] = ['web', 'mobile']

// Every web app shares `web`, its components; its framework's area holds the rest, since routing, rendering and
// structure differ between them end to end.
const CLIENT_AREAS = ['web-vite', 'web-next', 'web-astro', 'mobile']

export function areasFor(answers: Answers): string[] {
  const has = (type: AppType) => answers.types.includes(type)
  const templates: string[] = appsOf(answers).map(templateOf)

  return [
    'core',
    ...(has('api') ? ['api', 'database'] : []),
    ...(CLIENTS.some(has) ? ['client'] : []),
    ...(has('web') ? ['web'] : []),
    ...CLIENT_AREAS.filter((area) => templates.includes(area)),
    ...(answers.architecture === 'monorepo' ? ['monorepo'] : []),
    ...(answers.multiTenant ? ['multi-tenancy'] : []),
    ...(answers.mcp ? ['mcp'] : []),
    ...(answers.email || answers.signIn.includes('email-code') ? ['email'] : []),
    ...(answers.social.length > 0 ? ['social'] : []),
  ]
}

// An area is copied whole, then what it says about a feature the project left out is cut, as in a README.
async function copyArea(knowledge: string, prumo: string, area: string, answers: Answers) {
  const enabled = enabledFor(answers)

  await cp(join(knowledge, area), join(prumo, area), { recursive: true })

  for (const file of (await readdir(join(prumo, area))).filter((f) => f.endsWith('.md'))) {
    const path = join(prumo, area, file)
    const text = await readFile(path, 'utf8')
    const cut = cutFeatures(text, enabled, path)

    if (cut !== text) {
      await writeFile(path, cut)
    }
  }
}

async function titleOf(path: string): Promise<string> {
  const firstLine = (await readFile(path, 'utf8')).split('\n', 1)[0] ?? ''

  return firstLine.replace(/^#\s*/, '')
}

// The index lists every file of every area the project holds. It is the tool's file, so it is always rewritten.
async function writeIndex(prumo: string, areas: string[]): Promise<void> {
  const lines: string[] = []

  for (const area of areas) {
    for (const file of (await readdir(join(prumo, area))).filter((f) => f.endsWith('.md')).sort()) {
      lines.push(`- [${area}/${file}](${area}/${file}): ${await titleOf(join(prumo, area, file))}`)
    }
  }

  await writeFile(join(prumo, 'INDEX.md'), `# Conventions\n\n${lines.join('\n')}\n`)
}

async function writeConfig(prumo: string, answers: Answers): Promise<void> {
  // The version that wrote the project, so a tool reading it can tell a project made by an older Prumo.
  const config = {
    prumo: cliVersion(),
    types: answers.types,
    // Every app, with the framework of each web app, which nothing else records.
    apps: appsOf(answers),
    architecture: answers.architecture,
    multiTenant: answers.multiTenant,
    mcp: answers.mcp,
    signIn: answers.signIn,
    email: answers.email,
    social: answers.social,
  }

  await writeFile(join(prumo, 'config.json'), `${JSON.stringify(config, null, 2)}\n`)
}

export async function writeContext(
  knowledge: string,
  root: string,
  answers: Answers,
): Promise<void> {
  const prumo = join(root, '.prumo')
  const areas = areasFor(answers)

  await mkdir(prumo, { recursive: true })

  for (const area of areas) {
    await copyArea(knowledge, prumo, area, answers)
  }

  await writeIndex(prumo, areas)
  await writeConfig(prumo, answers)

  await writeFile(
    join(root, 'AGENTS.md'),
    `# ${answers.name}\n\nThis project's conventions live in \`.prumo/\`. Read [\`.prumo/INDEX.md\`](.prumo/INDEX.md) before changing how something is done.\n`,
  )
  await writeFile(join(root, 'CLAUDE.md'), '@AGENTS.md\n')
}

// A project that grew: the areas it now calls for and did not have arrive, and an area it had stays as the team left
// it. The index and the config follow; AGENTS.md is the team's, and is not touched. Returns the areas that arrived.
export async function growContext(
  knowledge: string,
  root: string,
  answers: Answers,
): Promise<string[]> {
  const prumo = join(root, '.prumo')
  const areas = areasFor(answers)
  const arrived = areas.filter((area) => !existsSync(join(prumo, area)))

  for (const area of arrived) {
    await copyArea(knowledge, prumo, area, answers)
  }

  await writeIndex(prumo, areas)
  await writeConfig(prumo, answers)

  return arrived
}
