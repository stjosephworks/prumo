import { existsSync } from 'node:fs'
import { readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import type { Language } from './languages.ts'

// A project of one language has its words written where they are shown, as a person writing it by hand would. The
// templates read every word from their messages, so an app of such a project leaves with each message written in
// its place, in the project's language, and with nothing of the languages' machinery: no messages, no list, no
// `[locale]` in its routes. What has no message of its own to write is marked `// prumo:multi-language` in the
// template, and what such a project has instead is written commented out, marked `// prumo:single-language`.

type Words = string | { [key: string]: Words }

// A messages file holds one object of strings, nested by what shows them, and nothing else that runs.
export function readMessages(source: string, file: string): Record<string, Words> {
  const start = source.search(/^export const \w+ = \{/m)

  if (start === -1) {
    throw new Error(`${file} does not export its messages as one object`)
  }

  return new Function(`return (${source.slice(source.indexOf('{', start)).trim()})`)()
}

// Where an expression ends, from the bracket it opens with, past strings and nested brackets.
function closing(text: string, open: number): number {
  const pairs: Record<string, string> = { '(': ')', '{': '}', '[': ']' }
  const stack: string[] = []
  let index = open

  while (index < text.length) {
    const char = text[index] as string

    if (char === "'" || char === '"' || char === '`') {
      index = stringEnd(text, index)
      continue
    }

    if (char in pairs) {
      stack.push(pairs[char] as string)
    } else if (char === stack.at(-1)) {
      stack.pop()

      if (stack.length === 0) {
        return index + 1
      }
    }

    index += 1
  }

  throw new Error(`An expression opened at ${open} never closes`)
}

function stringEnd(text: string, start: number): number {
  const quote = text[start]
  let index = start + 1

  while (index < text.length) {
    const char = text[index]

    if (char === '\\') {
      index += 2
      continue
    }

    if (char === quote) {
      return index + 1
    }

    if (quote === '`' && char === '$' && text[index + 1] === '{') {
      index = closing(text, index + 1)
      continue
    }

    index += 1
  }

  return index
}

// The entries of an object written in place, `{ to: sent.to, email }`, by name.
function entriesOf(object: string): Map<string, string> {
  const inner = object.slice(1, -1)
  const entries = new Map<string, string>()
  let depth = 0
  let start = 0

  const add = (entry: string) => {
    const trimmed = entry.trim()

    if (trimmed === '') {
      return
    }

    const colon = trimmed.search(/:/)
    const key = colon === -1 ? trimmed : trimmed.slice(0, colon).trim()

    entries.set(
      key.replace(/^['"]|['"]$/g, ''),
      colon === -1 ? key : trimmed.slice(colon + 1).trim(),
    )
  }

  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index] as string

    if (char === "'" || char === '"' || char === '`') {
      index = stringEnd(inner, index) - 1
    } else if ('({['.includes(char)) {
      depth += 1
    } else if (')}]'.includes(char)) {
      depth -= 1
    } else if (char === ',' && depth === 0) {
      add(inner.slice(start, index))
      start = index + 1
    }
  }

  add(inner.slice(start))

  return entries
}

const quote = (text: string) =>
  `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`

const quoteTemplate = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

// Text JSX reads as it is; anything it would read as markup, or trim, goes as a string instead.
function jsxText(text: string): string {
  return /[{}<>&]|^\s|\s$/.test(text) || text === '' ? `{${quote(text)}}` : text
}

const attributeSafe = (text: string) => !/["\\\n]/.test(text)

const PLACEHOLDER = /\{(\w+)\}/g

// A message's text and what fills it, split where each placeholder stands.
function pieces(
  text: string,
  values: Map<string, string>,
): ({ text: string } | { value: string })[] {
  const parts: ({ text: string } | { value: string })[] = []
  let last = 0

  for (const match of text.matchAll(PLACEHOLDER)) {
    const value = values.get(match[1] as string)

    if (value === undefined) {
      continue
    }

    parts.push({ text: text.slice(last, match.index) }, { value })
    last = match.index + match[0].length
  }

  parts.push({ text: text.slice(last) })

  return parts.filter((part) => !('text' in part) || part.text !== '')
}

type Context = 'child' | 'attribute' | 'interpolation' | 'code'

// Where a piece of code stands decides how a text replaces it: as JSX text, `{messages.x}` between tags; as an
// attribute's string, `label={messages.x}`; or as a string anywhere else.
function contextOf(
  text: string,
  start: number,
  end: number,
): { context: Context; from: number; to: number } {
  let before = start - 1
  let after = end

  while (before >= 0 && /\s/.test(text[before] as string)) {
    before -= 1
  }

  while (after < text.length && /\s/.test(text[after] as string)) {
    after += 1
  }

  if (text[before] === '{' && text[after] === '}') {
    if (text[before - 1] === '=') {
      return { context: 'attribute', from: before, to: after + 1 }
    }

    return text[before - 1] === '$'
      ? { context: 'interpolation', from: before - 1, to: after + 1 }
      : { context: 'child', from: before, to: after + 1 }
  }

  return { context: 'code', from: start, to: end }
}

// The roots a message is read from: the component's messages, a language's, a page's.
const ROOT =
  /(?<![\w$.'"/-])(?:messages|useMessages\(\)|messagesFor\(|\(await messagesOfPage\(params\)\))/g

type Leaf = { start: number; end: number; words: Words; path: string }

function leafAt(
  text: string,
  start: number,
  messages: Record<string, Words>,
  file: string,
): Leaf | undefined {
  let index = start

  if (text.startsWith('messagesFor(', index)) {
    index = closing(text, index + 'messagesFor'.length)
  } else if (text.startsWith('useMessages()', index)) {
    index += 'useMessages()'.length
  } else if (text.startsWith('(await messagesOfPage(params))', index)) {
    index += '(await messagesOfPage(params))'.length
  } else if (text.startsWith('messages', index)) {
    index += 'messages'.length
  } else {
    return undefined
  }

  // A key is named, `.title`, or written out, `['profile:read']`; one computed cannot be read ahead of time.
  const path = /^(?:\.[A-Za-z_$][\w$]*|\['[^'\n]+'\])+/.exec(text.slice(index))?.[0]

  if (path === undefined) {
    return undefined
  }

  const end = index + path.length

  if (text[end] === '[') {
    throw new Error(
      `${file} reads a message by a key it computes (${text.slice(start, end + 12)}…): mark it`,
    )
  }

  const keys = [...path.matchAll(/\.([A-Za-z_$][\w$]*)|\['([^'\n]+)'\]/g)].map(
    (key) => (key[1] ?? key[2]) as string,
  )
  let words: Words = messages

  for (const key of keys) {
    if (typeof words === 'string' || !(key in words)) {
      throw new Error(`${file} reads ${keys.join('.')}, which is not among the messages`)
    }

    words = words[key] as Words
  }

  return { start, end, words, path: keys.join('.') }
}

function literalOf(words: Words): string {
  if (typeof words === 'string') {
    return quote(words)
  }

  return `{ ${Object.entries(words)
    .map(
      ([key, value]) => `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : quote(key)}: ${literalOf(value)}`,
    )
    .join(', ')} }`
}

function textOf(leaf: Leaf, file: string): string {
  if (typeof leaf.words !== 'string') {
    throw new Error(`${file} formats ${leaf.path}, which is not one text`)
  }

  return leaf.words
}

type Replacement = { from: number; to: number; with: string }

function apply(text: string, replacements: Replacement[]): string {
  let result = text

  for (const replacement of replacements.sort((a, b) => b.from - a.from)) {
    result = result.slice(0, replacement.from) + replacement.with + result.slice(replacement.to)
  }

  return result
}

// `format(messages.x, { code })` and `rich(messages.x, { to: <strong>{to}</strong> })`: the text with each value in
// its placeholder's place.
function inlineCalls(text: string, messages: Record<string, Words>, file: string): string {
  const replacements: Replacement[] = []

  for (const match of text.matchAll(/(?<![\w$.])(format|rich|startOf)\(/g)) {
    const call = match[1] as 'format' | 'rich' | 'startOf'
    const open = match.index + call.length
    const end = closing(text, open)
    const leaf = leafAt(text, open + 1, messages, file)

    if (leaf === undefined) {
      throw new Error(`${file} calls ${match[1]} on something other than a message: mark it`)
    }

    const message = textOf(leaf, file)
    const rest = text.slice(leaf.end, end - 1).trim()

    if (match[1] === 'startOf') {
      const start = (message.split('{')[0] ?? message).trim()

      replacements.push({
        from: match.index,
        to: end,
        with: `/${start.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}/`,
      })
      continue
    }

    const values = entriesOf(rest.replace(/^,/, '').trim())
    const parts = pieces(message, values)
    const where = contextOf(text, match.index, end)

    if (where.context === 'child') {
      const jsx = parts
        .map((part) =>
          'text' in part
            ? jsxText(part.text)
            : match[1] === 'rich' && part.value.startsWith('<')
              ? part.value
              : `{${part.value}}`,
        )
        .join('')

      replacements.push({ from: where.from, to: where.to, with: jsx })
    } else if (match[1] === 'rich') {
      throw new Error(`${file} calls rich outside JSX`)
    } else if (where.context === 'interpolation') {
      // Already inside a template literal, `${format(…)}`: its text joins the literal's.
      const inner = parts
        .map((part) => ('text' in part ? quoteTemplate(part.text) : `\${${part.value}}`))
        .join('')

      replacements.push({ from: where.from, to: where.to, with: inner })
    } else {
      const template = `\`${parts.map((part) => ('text' in part ? quoteTemplate(part.text) : `\${${part.value}}`)).join('')}\``

      replacements.push(
        where.context === 'attribute'
          ? { from: where.from, to: where.to, with: `{${template}}` }
          : { from: match.index, to: end, with: template },
      )
    }
  }

  return apply(text, replacements)
}

function inlineLeaves(text: string, messages: Record<string, Words>, file: string): string {
  const replacements: Replacement[] = []

  for (const match of text.matchAll(ROOT)) {
    const leaf = leafAt(text, match.index, messages, file)

    if (leaf === undefined) {
      continue
    }

    const where = contextOf(text, leaf.start, leaf.end)

    if (typeof leaf.words !== 'string') {
      replacements.push({ from: leaf.start, to: leaf.end, with: literalOf(leaf.words) })
    } else if (where.context === 'child') {
      replacements.push({ from: where.from, to: where.to, with: jsxText(leaf.words) })
    } else if (where.context === 'interpolation') {
      replacements.push({ from: where.from, to: where.to, with: quoteTemplate(leaf.words) })
    } else if (where.context === 'attribute' && attributeSafe(leaf.words)) {
      replacements.push({ from: where.from, to: where.to, with: `"${leaf.words}"` })
    } else {
      replacements.push({ from: leaf.start, to: leaf.end, with: quote(leaf.words) })
    }
  }

  return apply(text, replacements)
}

// An address in the app, written without its language once the app has one: `localePath('/sign-in')`, and a
// test's `at('/sign-in')`. The language's own tag, where something still names it, is written as it is.
function inlineAddresses(text: string, language: Language): string {
  const replacements: Replacement[] = []

  const addresses =
    /(?<![\w$.])(?:localePath|at)\(('[^'\n]*')\)|`\/\$\{segmentOf\(locale\)\}(\/[^`$\n]*)`|(?<![\w$.])BASE_LOCALE\b/g

  for (const match of text.matchAll(addresses)) {
    const where = contextOf(text, match.index, match.index + match[0].length)
    // A page's `lang` names a region by its letters or not at all, as `hreflang` does: es-419 is `es` there.
    const tag = text.slice(Math.max(0, where.from - 5), where.from).endsWith('lang=')
      ? language.replace(/-\d+$/, '')
      : language
    const value = match[1]?.slice(1, -1) ?? match[2] ?? tag

    replacements.push(
      where.context === 'attribute'
        ? { from: where.from, to: where.to, with: `"${value}"` }
        : where.context === 'interpolation'
          ? { from: where.from, to: where.to, with: quoteTemplate(value) }
          : { from: match.index, to: match.index + match[0].length, with: quote(value) },
    )
  }

  return apply(text, replacements)
}

// The modules a project of one language does not have, and what is imported from them.
const GONE = /^(?:@\/i18n\/|@app\/i18n$|@\/features\/i18n\/|@test\/support\/messages$)/

function dropImports(text: string): string {
  return text.replace(
    /^import (?:type )?(?:\{[^}]*\}|[\w$]+|\* as [\w$]+)(?:, \{[^}]*\})? from '([^']+)'[^\n]*\n/gm,
    (statement, from: string) => (GONE.test(from) ? '' : statement),
  )
}

// What an import names and nothing uses any longer goes, and so does an import left naming nothing.
function pruneImports(text: string): string {
  return text.replace(
    /^import (type )?\{([^}]*)\} from ('[^']+')([^\n]*)\n/gm,
    (statement, type: string | undefined, names: string, from: string, rest: string) => {
      // A spread, `...ATTEMPTS`, uses the name as much as a mention does.
      const others = text.replace(statement, '').replaceAll('...', ' ')
      const kept = names
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name !== '')
        .filter((name) => {
          const local = name
            .replace(/^type /, '')
            .split(' as ')
            .at(-1) as string

          return new RegExp(`(?<![\\w$.])${local.replace(/\$/g, '\\$')}(?![\\w$])`).test(others)
        })

      if (kept.length === names.split(',').filter((name) => name.trim() !== '').length) {
        return statement
      }

      return kept.length === 0
        ? ''
        : `import ${type ?? ''}{ ${kept.join(', ')} } from ${from}${rest}\n`
    },
  )
}

// A function that took the messages only to read them takes nothing, and one built from them alone is what it built.
function dropParameters(text: string): string {
  let result = text

  for (const match of text.matchAll(/^(\s*)const (\w+)Of = \(messages: Messages\) =>/gm)) {
    const name = match[2] as string

    result = result
      .replace(
        new RegExp(
          `^[ \\t]*const ${name} = useMemo\\(\\(\\) => ${name}Of\\(messages\\), \\[messages\\]\\)\\n`,
          'gm',
        ),
        '',
      )
      .replace(`const ${name}Of = (messages: Messages) =>`, `const ${name} =`)
      .replace(new RegExp(`\\b${name}Of\\(messages\\)`, 'g'), name)
      .replace(new RegExp(`ReturnType<typeof ${name}Of>`, 'g'), `typeof ${name}`)
  }

  return result
    .replace(/\(messages(?:: Messages)?\) => /g, '')
    .replace(/\?\.\(messages\)/g, '')
    .replace(/,\s*messages: Messages(?=\s*[),])/g, '')
    .replace(/^[ \t]*messages: Messages,?\n/gm, '')
    .replace(/,\s*messages(?=\s*[)\]])/g, '')
    .replace(/^[ \t]*messages,\n(?=[ \t]*\))/gm, '')
}

// A language passed along, the request's or a profile's, is passed nowhere: what it was passed to has none to choose.
function dropLocale(text: string): string {
  return (
    text
      .replace(
        /\{ \.\.\.request\.body, locale: request\.body\.locale \?\? request\.locale \}/g,
        'request.body',
      )
      .replace(/,\s*locale: Locale(?=\s*[),])/g, '')
      .replace(/,\s*request\.locale(?=\s*\))/g, '')
      .replace(/^[ \t]*(?:locale(?:: [^\n]+)?|request\.locale),?\n/gm, '')
      .replace(/,\s*BASE_LOCALE(?=\s*\))/g, '')
      // An Astro page is built once, takes no language from its props, and hands none to what it renders.
      .replace(/^export function getStaticPaths\(\) \{\n\s*return localePaths\(\)\n\}\n\n?/m, '')
      .replace(/^[ \t]*const \{ locale \} = [^\n]+\n/gm, '')
      .replace(/ locale=\{locale\}/g, '')
      .replace(/\blang=\{locale\}/g, 'lang={BASE_LOCALE}')
      .replace(/;\s*locale\??: Locale(?=\s*\})/g, '')
      .replace(/([{,] )locale = [^,}\n]+, /g, '$1')
      .replace(/([{,] )locale, /g, '$1')
      .replace(/([{,] )locale: [^,{}\n]+, /g, '$1')
      .replace(/'locale', /g, '')
      .replace(/, locale \}/g, ' }')
      .replace(/, \{ locale \}\)/g, ')')
      .replace(/,\s*\{\n\s*\}\)/g, ')')
      .replace(/^[ \t]*this\.locale = [^\n]+\n/gm, '')
      .replace(/locale\?: string; /g, '')
      .replace(/ \| 'locale'(?= )|'locale' \| /g, '')
  )
}

// An error a person reads names its message in the template; written in place, the message is the error's own.
function inlineErrorTexts(text: string, messages: Record<string, Words>): string {
  const errors = messages.errors

  if (errors === undefined || typeof errors === 'string' || !text.includes('DomainError')) {
    return text
  }

  return text
    .replace(/^([ \t]*)override readonly text = '(\w+)'\n/m, (line, indent: string, key: string) =>
      /constructor\(/.test(text) || !(key in errors)
        ? line
        : `\n${indent}constructor() {\n${indent}  super(messages.errors.${key})\n${indent}}\n`,
    )
    .replace(
      /(new \w+Error\()'(\w+)'(?:, (\{[^}]*\}))?\)/g,
      (call, open: string, key: string, values?: string) =>
        key in errors
          ? `${open}${values === undefined ? `messages.errors.${key}` : `format(messages.errors.${key}, ${values})`})`
          : call,
    )
}

// What wraps a tree or a transport only to give it the language leaves what it wrapped: `<I18nProvider>` its
// children, `withLanguage(fetch)` the fetch.
function unwrap(text: string): string {
  // The switcher and the account's language have nothing to switch or follow.
  let result = text
    .replace(/^[ \t]*<\/?I18nProvider(?: [^>]*)?>,?\n/gm, '')
    .replace(/^[ \t]*(?:<LanguageSwitcher[^>\n]*\/>|useAccountLanguage\([^)\n]*\))\n/gm, '')

  for (
    let at = result.search(/(?<![\w$.])withLanguage\(/);
    at !== -1;
    at = result.search(/(?<![\w$.])withLanguage\(/)
  ) {
    const open = at + 'withLanguage'.length
    const end = closing(result, open)

    result =
      result.slice(0, at) + result.slice(open + 1, end - 1).replace(/,\s*$/, '') + result.slice(end)
  }

  return result
}

// A Next page read its words by its address's language; with one language its metadata is a constant, and the page
// needs no params to read.
function settlePages(text: string): string {
  return text
    .replace(
      /export async function generateMetadata\(\{\s*params,?\s*\}: PageProps<'[^']*'>\): Promise<Metadata> \{\n\s*return (\{[^\n]*\})\n\}/g,
      'export const metadata: Metadata = $1',
    )
    .replace(
      /export default async function (\w+)\(\{ params \}: PageProps<'[^']*'>\) \{\n[ \t]*const messages = await messagesOfPage\(params\)\n\n?/g,
      'export default function $1() {\n',
    )
    .replace(/,\s*localePath(?=\s*\])/g, '')
}

// A line that only reached the messages goes, and the blank line it leaves at the top of a block with it.
function dropLines(text: string): string {
  return text.replace(
    /(\{\n)?^[ \t]*const (?:messages = (?:useMessages\(\)|messagesFor\([^\n]*\)|await messagesOfPage\(params\))|localePath = useLocalePath\(\))\n(\n)?/gm,
    (_, open: string | undefined, blank: string | undefined) =>
      open === undefined ? (blank ?? '') : open,
  )
}

// What a project of one language must not read from anywhere: if a template still does, it was not marked.
const LEFT = [
  /(?<![\w$.'"/-])messages(?=[.)\],])/,
  /\b(?:useMessages|messagesFor|messagesOfPage|useLocalePath|localePath|I18nProvider|withLanguage|currentLocale|negotiateLocale|LOCALE_INFO|LOCALES)\b/,
  /(?<![\w$.])(?:format|rich|startOf)\(/,
  /(?<!\w)Messages\b/,
  /'@\/i18n\/|'@app\/i18n'|\[locale\]/,
  /(?<![\w$.'"-])(?:locale|Locale)(?![\w$])/,
]

export function inlineSource(
  text: string,
  messages: Record<string, Words>,
  language: Language,
  file: string,
) {
  // A file with nothing of the languages' still loses the imports a cut block was their only use of.
  if (!/messages|Messages|locale|Locale|BASE_LOCALE|i18n|\bat\(|DomainError/.test(text)) {
    return pruneImports(text)
  }

  let result = inlineErrorTexts(
    unwrap(dropLines(dropLocale(dropParameters(settlePages(dropImports(text)))))),
    messages,
  )

  result = inlineAddresses(
    inlineLeaves(inlineCalls(result, messages, file), messages, file),
    language,
  )
  result = pruneImports(result)
    .replace(/'\/\[locale\]'/g, "'/'")
    .replace(/\/\[locale\](?=[/'])/g, '')

  const left = result
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line) && LEFT.some((each) => each.test(line)))

  if (left.length > 0) {
    throw new Error(
      `${file} still reaches the languages' machinery:\n${left.map((line) => `  ${line.trim()}`).join('\n')}`,
    )
  }

  return result
}

async function filesUnder(directory: string): Promise<string[]> {
  if (!existsSync(directory)) {
    return []
  }

  const entries = await readdir(directory, { withFileTypes: true, recursive: true })

  return entries
    .filter((entry) => entry.isFile() && /\.(tsx?|astro)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
}

// A route folder named for the language, `src/app/[locale]/`, hands its routes to the folder that holds it.
async function hoistLocaleRoutes(directory: string): Promise<void> {
  if (!existsSync(directory)) {
    return
  }

  const entries = await readdir(directory, { withFileTypes: true, recursive: true })

  for (const entry of entries.filter((each) => each.isDirectory() && each.name === '[locale]')) {
    const folder = join(entry.parentPath, entry.name)

    // A route that reached past the folder, `../globals.css`, is one level nearer once the folder is gone.
    for (const file of await filesUnder(folder)) {
      const text = await readFile(file, 'utf8')
      const moved = text.replace(
        /((?:from |import )')(\.\.?\/[^']+)'/g,
        (whole, lead: string, path: string) => {
          const target = resolve(dirname(file), path)

          if (target.startsWith(`${folder}/`)) {
            return whole
          }

          const nearer = relative(dirname(file).replace(folder, dirname(folder)), target)

          return `${lead}${nearer.startsWith('.') ? nearer : `./${nearer}`}'`
        },
      )

      if (moved !== text) {
        await writeFile(file, moved)
      }
    }

    for (const child of await readdir(folder)) {
      const destination = join(dirname(folder), child)

      if (existsSync(destination)) {
        throw new Error(`${destination} already exists, where a route of [locale] goes`)
      }

      await rename(join(folder, child), destination)
    }

    await rm(folder, { recursive: true })
  }
}

export async function inlineMessages(app: string, language: Language): Promise<void> {
  const file = join(app, 'src', 'i18n', 'messages', `${language}.ts`)
  const messages = readMessages(await readFile(file, 'utf8'), file)

  await rm(join(app, 'src', 'i18n'), { recursive: true, force: true })
  await rm(join(app, 'test', 'i18n'), { recursive: true, force: true })
  await rm(join(app, 'test', 'support', 'messages.ts'), { force: true })

  const problems: string[] = []

  for (const source of [
    ...(await filesUnder(join(app, 'src'))),
    ...(await filesUnder(join(app, 'test'))),
  ]) {
    const text = await readFile(source, 'utf8')

    try {
      const inlined = inlineSource(text, messages, language, source)

      if (inlined !== text) {
        await writeFile(source, inlined)
      }
    } catch (error) {
      problems.push((error as Error).message)
    }
  }

  // Every file a template left unmarked at once, so a template is fixed in one pass.
  if (problems.length > 0) {
    throw new Error(problems.join('\n'))
  }

  await hoistLocaleRoutes(join(app, 'src'))
}
