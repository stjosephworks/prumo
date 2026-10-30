import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type App, appsOf, templateOf } from './apps.ts'
import type { AppType } from './compose.ts'
import { cutFeatures, enabledFor, type SignInMethod, type SocialProvider } from './features.ts'
import type { Language } from './languages.ts'
import { cliVersion } from './version.ts'

export type Answers = {
  name: string
  types: AppType[]
  // Absent, the apps are one per type, named after it: what every project held before apps had names.
  apps?: App[]
  architecture: 'alone' | 'monorepo'
  multiTenant: boolean
  // Whether the project speaks its languages from messages, or one language written where it is shown; from 0.10.0.
  // Before it, one: English, written in each component.
  multiLanguage: boolean
  // The languages the project speaks, its base first: one, when it speaks one. From 0.10.0; before it, English.
  languages: Language[]
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
    // A project that speaks its languages from messages does so whatever its types.
    ...(answers.multiLanguage ? ['i18n'] : []),
    ...(has('api') ? ['api', 'database'] : []),
    ...(CLIENTS.some(has) ? ['client'] : []),
    ...(has('web') ? ['web'] : []),
    ...CLIENT_AREAS.filter((area) => templates.includes(area)),
    ...(answers.architecture === 'monorepo' ? ['monorepo'] : []),
    ...(answers.multiTenant ? ['multi-tenancy'] : []),
    ...(answers.mcp ? ['mcp'] : []),
    ...(answers.email || answers.signIn.some((method) => method !== 'password') ? ['codes'] : []),
    ...(answers.email || answers.signIn.includes('email-code') ? ['email'] : []),
    ...(answers.signIn.includes('phone-code') ? ['phone'] : []),
    ...(answers.social.length > 0 ? ['social'] : []),
  ]
}

// An area is copied whole, then what it says about a feature the project left out is cut, as in a README.
async function copyArea(knowledge: string, prumo: string, area: string, answers: Answers) {
  const enabled = enabledFor(answers)

  await cp(join(knowledge, area), join(prumo, area), { recursive: true })

  // What each type adds to the languages' area is its `languages.md`, which a project of one language has no use for.
  if (!answers.multiLanguage) {
    await rm(join(prumo, area, 'languages.md'), { force: true })
  }

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
    multiLanguage: answers.multiLanguage,
    languages: answers.languages,
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

  // The project's own rules start with an empty index; from here on `.context/` is the team's, and the assistant's
  // that writes in it as `core/context.md` says.
  await mkdir(join(root, '.context'), { recursive: true })
  await writeFile(
    join(root, '.context', 'INDEX.md'),
    '# Project rules\n\nThe rules this project decided for itself, one line per file. Where one disagrees with `.prumo/`, it wins; `.prumo/core/context.md` says when one is written here.\n',
  )

  await writeFile(
    join(root, 'AGENTS.md'),
    `# ${answers.name}

This project's rules live in two places. Read both indexes before changing how something is done:

- [\`.context/INDEX.md\`](.context/INDEX.md): the rules this project decided for itself. **They win wherever they disagree with \`.prumo/\`.** [\`.prumo/core/context.md\`](.prumo/core/context.md) says when a new one is written there.
- [\`.prumo/INDEX.md\`](.prumo/INDEX.md): the conventions Prumo ships.
`,
  )
  await writeFile(join(root, 'CLAUDE.md'), '@AGENTS.md\n')
}

// A project that grew: the areas it now calls for and did not have arrive, and an area it had stays as the team left
// it. The index and the config follow; AGENTS.md and `.context/` are the team's, and are not touched. Returns the
// areas that arrived.
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
