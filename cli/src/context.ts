import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppType } from './compose.ts'
import { cliVersion } from './version.ts'

export type Answers = {
  name: string
  types: AppType[]
  architecture: 'alone' | 'monorepo'
  multiTenant: boolean
  mcp: boolean
}

const CLIENTS: AppType[] = ['web', 'mobile', 'site']

export function areasFor(answers: Answers): string[] {
  const has = (type: AppType) => answers.types.includes(type)

  return [
    'core',
    ...(has('api') ? ['api', 'database'] : []),
    ...(CLIENTS.some(has) ? ['client'] : []),
    ...CLIENTS.filter(has),
    ...(answers.architecture === 'monorepo' ? ['monorepo'] : []),
    ...(answers.multiTenant ? ['multi-tenancy'] : []),
    ...(answers.mcp ? ['mcp'] : []),
  ]
}

async function titleOf(path: string): Promise<string> {
  const firstLine = (await readFile(path, 'utf8')).split('\n', 1)[0] ?? ''

  return firstLine.replace(/^#\s*/, '')
}

export async function writeContext(
  knowledge: string,
  root: string,
  answers: Answers,
): Promise<void> {
  const prumo = join(root, '.prumo')
  const lines: string[] = []

  await mkdir(prumo, { recursive: true })

  for (const area of areasFor(answers)) {
    await cp(join(knowledge, area), join(prumo, area), { recursive: true })

    for (const file of (await readdir(join(prumo, area))).filter((f) => f.endsWith('.md')).sort()) {
      lines.push(`- [${area}/${file}](${area}/${file}): ${await titleOf(join(prumo, area, file))}`)
    }
  }

  await writeFile(join(prumo, 'INDEX.md'), `# Conventions\n\n${lines.join('\n')}\n`)

  // The version that wrote the project, so a tool reading it can tell a project made by an older Prumo.
  const config = {
    prumo: cliVersion(),
    types: answers.types,
    architecture: answers.architecture,
    multiTenant: answers.multiTenant,
    mcp: answers.mcp,
  }

  await writeFile(join(prumo, 'config.json'), `${JSON.stringify(config, null, 2)}\n`)

  await writeFile(
    join(root, 'AGENTS.md'),
    `# ${answers.name}\n\nThis project's conventions live in \`.prumo/\`. Read [\`.prumo/INDEX.md\`](.prumo/INDEX.md) before changing how something is done.\n`,
  )
  await writeFile(join(root, 'CLAUDE.md'), '@AGENTS.md\n')
}
