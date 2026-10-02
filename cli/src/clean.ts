import { existsSync } from 'node:fs'
import { readdir, readFile, rm, rmdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { apiPath, findProjectRoot, readConfig } from './database.ts'
import { readJsonc, setJsonc } from './jsonc.ts'
import { CliError } from './output.ts'
import { cliVersion } from './version.ts'

// What a generated project needs once and then carries forever: today, the database bootstrap. Each item is removed
// only while it is still exactly what was generated; anything the team has changed is theirs, and stays.
export type ItemStatus = 'pending' | 'modified' | 'absent' | 'removed'

export type Item = { id: string; path: string; description: string; status: ItemStatus }

export type CleanPlan = { root: string; items: Item[]; apply: () => Promise<void> }

type Rule = {
  id: string
  file: string
  description: string
  inspect: (text: string) => Exclude<ItemStatus, 'absent' | 'removed'> | 'absent'
  change: (text: string) => string
}

const SAMPLE_URL = 'postgresql://app:app@localhost:5432/app'

export const API_DEV_PREFIX = 'node scripts/database.mjs --check && '
export const ROOT_DEV_PREFIX = 'node apps/api/scripts/database.mjs --check && '
export const SETUP_SCRIPT = 'node scripts/database.mjs'

export const EXAMPLE_BLOCK =
  '# MISSING until `pnpm db:setup` creates a database; `pnpm dev` offers to run it.\n' +
  'DATABASE_URL=MISSING\nAUTH_DATABASE_URL=MISSING\n'

export const README_PARAGRAPH =
  '`DATABASE_URL` starts as `MISSING`. While it is, `pnpm dev` offers to create the database first: it asks for a name,\n' +
  'starts Postgres from `docker-compose.yml` on port 5432 or the next free one (kept in `POSTGRES_PORT`), writes the URL\n' +
  'into `.env`, and migrates. `pnpm db:setup` does the same at any time. Without a terminal every answer comes from a\n' +
  'flag: `--name`, `--port`, `--skip-migrate`, and `--json` for one JSON result on stdout.\n'

const README_REPLACEMENT =
  'Before the first `pnpm dev`, start Postgres with `docker compose up -d --wait` and run `pnpm db:migrate`.\n' +
  '`.env.example` points at that service on port 5432; when `POSTGRES_PORT` changes, change both URLs with it.\n'

export const README_ROW =
  '| `pnpm db:setup` | Creates a development database in Docker, writes its URL into `.env`, and migrates |\n'

export const WORKSPACE_SENTENCE =
  'If the workspace holds `api` and its database is not set up yet, `pnpm dev` offers to create the database first.\n\n'

function textRule(
  id: string,
  file: string,
  description: string,
  from: string,
  to: string,
  marker: string,
): Rule {
  return {
    id,
    file,
    description,
    inspect: (text) =>
      text.includes(from) ? 'pending' : text.includes(marker) ? 'modified' : 'absent',
    change: (text) => text.replace(from, to),
  }
}

function scriptRule(
  id: string,
  file: string,
  description: string,
  key: string,
  decide: (value: string) => { status: 'pending' | 'modified' | 'absent'; next?: string },
): Rule {
  const scriptOf = (text: string) =>
    readJsonc<{ scripts?: Record<string, string> }>(text).scripts?.[key]

  return {
    id,
    file,
    description,
    inspect: (text) => {
      const value = scriptOf(text)
      return value === undefined ? 'absent' : decide(value).status
    },
    change: (text) => setJsonc(text, ['scripts', key], decide(scriptOf(text) ?? '').next),
  }
}

function devRule(id: string, file: string, prefix: string): Rule {
  return scriptRule(id, file, `Stop checking the database before \`dev\``, 'dev', (value) =>
    value.startsWith(prefix)
      ? { status: 'pending', next: value.slice(prefix.length) }
      : { status: value.includes('database.mjs') ? 'modified' : 'absent', next: value },
  )
}

function rulesFor(root: string, api: string, templates: string): { rules: Rule[]; script: string } {
  const at = (file: string) => relative(root, join(api, file))
  const rules: Rule[] = [
    devRule('api-dev-check', at('package.json'), API_DEV_PREFIX),
    scriptRule(
      'api-db-setup',
      at('package.json'),
      'Remove the `db:setup` script',
      'db:setup',
      (value) =>
        value === SETUP_SCRIPT ? { status: 'pending' } : { status: 'modified', next: value },
    ),
    textRule(
      'api-env-example',
      at('.env.example'),
      'Put a sample database URL back in `.env.example`',
      EXAMPLE_BLOCK,
      `DATABASE_URL=${SAMPLE_URL}\nAUTH_DATABASE_URL=${SAMPLE_URL}\n`,
      '=MISSING',
    ),
    textRule(
      'api-readme-setup',
      at('README.md'),
      'Replace the README paragraph about `MISSING`',
      README_PARAGRAPH,
      README_REPLACEMENT,
      'db:setup',
    ),
    textRule(
      'api-readme-row',
      at('README.md'),
      'Remove `db:setup` from the README',
      README_ROW,
      '',
      '`pnpm db:setup`',
    ),
  ]

  if (api !== root) {
    rules.push(
      devRule('root-dev-check', 'package.json', ROOT_DEV_PREFIX),
      textRule(
        'root-readme',
        'README.md',
        'Remove the database offer from the README',
        WORKSPACE_SENTENCE,
        '',
        'offers to create the database',
      ),
    )
  }

  return { rules, script: join(templates, 'api', 'scripts', 'database.mjs') }
}

export async function planClean({
  cwd,
  templates,
  force,
}: {
  cwd: string
  templates: string
  force: boolean
}): Promise<CleanPlan> {
  const root = findProjectRoot(cwd)
  const api = apiPath(root)

  if (api === undefined) {
    return { root, items: [], apply: async () => {} }
  }

  // "Exactly what was generated" is judged against this CLI's templates. Another version shipped other text, and
  // every untouched file would read as changed by the team, so only the version that wrote the project cleans it.
  const wrote = readConfig(root).prumo
  const running = cliVersion()

  if (wrote !== running) {
    throw new CliError(
      'version_mismatch',
      wrote === undefined
        ? `This project predates Prumo 0.1.1, which began recording its version. Run \`prumo clean\` from the version that generated it, such as \`npx @stjoseph/prumo@0.1.0 clean\`.`
        : `This project was generated by Prumo ${wrote}, and this is ${running}. Run \`npx @stjoseph/prumo@${wrote} clean\`.`,
    )
  }

  const env = await readFile(join(api, '.env'), 'utf8').catch(() => undefined)

  if (!force && env !== undefined && /^DATABASE_URL=MISSING$/m.test(env)) {
    throw new CliError(
      'database_missing',
      'DATABASE_URL is still MISSING: set the database up before removing what sets it up, or pass --force.',
    )
  }

  const { rules, script } = rulesFor(root, api, templates)
  const items: Item[] = []
  const pending: Rule[] = []

  for (const rule of rules) {
    const text = await readFile(join(root, rule.file), 'utf8').catch(() => undefined)
    const status = text === undefined ? 'absent' : rule.inspect(text)

    items.push({ id: rule.id, path: rule.file, description: rule.description, status })
    if (status === 'pending') {
      pending.push(rule)
    }
  }

  const scriptPath = join(api, 'scripts', 'database.mjs')
  const shipped = await readFile(script, 'utf8')
  const current = await readFile(scriptPath, 'utf8').catch(() => undefined)
  const scriptItem: Item = {
    id: 'api-database-script',
    path: relative(root, scriptPath),
    description: 'Delete the database setup script',
    status: current === undefined ? 'absent' : current === shipped ? 'pending' : 'modified',
  }

  items.push(scriptItem)

  return {
    root,
    items,
    apply: async () => {
      for (const rule of pending) {
        const path = join(root, rule.file)
        await writeFile(path, rule.change(await readFile(path, 'utf8')))
      }

      if (scriptItem.status === 'pending') {
        await rm(scriptPath)
        if (existsSync(dirname(scriptPath)) && (await readdir(dirname(scriptPath))).length === 0) {
          await rmdir(dirname(scriptPath))
        }
      }

      for (const item of items) {
        if (item.status === 'pending') {
          item.status = 'removed'
        }
      }
    },
  }
}

const SYMBOL: Record<ItemStatus, string> = {
  pending: '-',
  removed: '✓',
  modified: '!',
  absent: '·',
}

export function cleanText(items: Item[]): string {
  if (items.length === 0) {
    return 'Nothing to clean.'
  }

  return items
    .map((item) => {
      const note =
        item.status === 'modified'
          ? ' (changed since generated; kept)'
          : item.status === 'absent'
            ? ' (already gone)'
            : ''
      return `${SYMBOL[item.status]} ${item.description}: ${item.path}${note}`
    })
    .join('\n')
}
