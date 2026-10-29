import { existsSync } from 'node:fs'
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { cutFeature } from './features.ts'
import { CliError } from './output.ts'

// The languages Prumo translates every template into and keeps translated. A project speaks one or more of them, its
// base first; any other is the project's to add once it exists (.prumo/i18n/languages.md).
export const LANGUAGES = ['en', 'pt-BR', 'es-419'] as const

export type Language = (typeof LANGUAGES)[number]

// How each is offered: in its own words, which is how a speaker looks for it.
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  'pt-BR': 'Português (Brasil)',
  'es-419': 'Español (Latinoamérica)',
}

// The order is the answer: the first is the base, the rest follow it. A tag is read in any case and given once.
export function parseLanguages(value: string): Language[] {
  const tags = value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '')
  const languages: Language[] = []
  const unknown: string[] = []

  for (const tag of tags) {
    const language = LANGUAGES.find((each) => each.toLowerCase() === tag.toLowerCase())

    if (language === undefined) {
      unknown.push(tag)
    } else if (!languages.includes(language)) {
      languages.push(language)
    }
  }

  if (languages.length === 0 || unknown.length > 0) {
    throw new CliError(
      'invalid_input',
      `Unknown language: ${unknown.join(', ') || '(none)'}. Choose one or more of ${LANGUAGES.join(', ')}, the base first; another is added once the project exists, as .prumo/i18n/languages.md says.`,
    )
  }

  return languages
}

// The name a language's messages are exported under: `pt-BR` is `ptBR`, `es-419` is `es419`.
function variableOf(language: Language): string {
  return language.replace(/-(\w)/g, (_, next: string) => next.toUpperCase())
}

async function sourceFiles(directory: string): Promise<string[]> {
  if (!existsSync(directory)) {
    return []
  }

  const entries = await readdir(directory, { withFileTypes: true, recursive: true })

  return entries
    .filter((entry) => entry.isFile() && /\.(tsx?|astro)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
}

function replaceLine(text: string, line: RegExp, replacement: string, file: string): string {
  if (!line.test(text)) {
    throw new Error(`${file} no longer carries ${line}`)
  }

  return text.replace(line, replacement)
}

const LOCALES_LINE = /^export const LOCALES = \[.*\] as const$/m

const MESSAGES_TYPE = /^export type Messages = typeof \w+$/m

// The column every profile's language starts from, in the migration that creates it.
const LOCALE_COLUMN = /"locale" text not null default '[^']*'/

// A template speaks every language Prumo offers, English as its base. An app leaves with the project's: the others'
// messages deleted and every line or block marked `// prumo:<language>` cut, the list in the project's order, and
// every language checked against the base's messages.
export async function applyLanguages(app: string, languages: Language[]): Promise<void> {
  const [base] = languages

  if (base === undefined) {
    throw new Error('A project speaks at least one language')
  }

  for (const language of LANGUAGES.filter((each) => !languages.includes(each))) {
    for (const messages of await sourceFiles(app)) {
      if (messages.endsWith(join('i18n', 'messages', `${language}.ts`))) {
        await rm(messages)
      }
    }
  }

  const sources = [
    ...(await sourceFiles(join(app, 'src'))),
    ...(await sourceFiles(join(app, 'test'))),
    join(app, '.env.example'),
    join(app, 'README.md'),
    join(app, 'app.config.ts'),
    join(app, 'jest.config.js'),
  ]

  for (const source of sources.filter((path) => existsSync(path))) {
    const text = await readFile(source, 'utf8')
    let cut = LANGUAGES.reduce(
      (current, language) => cutFeature(current, language, languages.includes(language), source),
      text,
    )

    if (source.endsWith(join('src', 'i18n', 'locales.ts'))) {
      const list = languages.map((language) => `'${language}'`).join(', ')
      cut = replaceLine(cut, LOCALES_LINE, `export const LOCALES = [${list}] as const`, source)
    }

    if (source.endsWith(join('i18n', 'messages', 'index.ts'))) {
      cut = replaceLine(
        cut,
        MESSAGES_TYPE,
        `export type Messages = typeof ${variableOf(base)}`,
        source,
      )
    }

    if (cut !== text) {
      await writeFile(source, cut)
    }
  }

  const migrations = join(app, 'migrations')

  for (const migration of await readdir(migrations).catch(() => [])) {
    const path = join(migrations, migration)
    const text = await readFile(path, 'utf8')

    if (LOCALE_COLUMN.test(text)) {
      await writeFile(path, text.replace(LOCALE_COLUMN, `"locale" text not null default '${base}'`))
    }
  }
}
