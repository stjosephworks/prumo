import { existsSync } from 'node:fs'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Answers } from '../src/context.ts'
import { generate } from '../src/generate.ts'
import { parseLanguages } from '../src/languages.ts'
import { type Flags, resolveAnswers } from '../src/questions.ts'

const templates = resolve(import.meta.dirname, '../../templates')
const knowledge = resolve(import.meta.dirname, '../../.prumo-templates')

const flags = (overrides: Partial<Flags>): Flags => ({
  name: 'acme',
  types: 'api',
  apps: undefined,
  alone: true,
  monorepo: false,
  multiTenant: false,
  singleTenant: true,
  multiLanguage: true,
  singleLanguage: false,
  languages: undefined,
  mcp: false,
  noMcp: false,
  signIn: 'password',
  email: false,
  noEmail: true,
  social: undefined,
  noSocial: false,
  ...overrides,
})

async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true, recursive: true })

  return entries
    .filter((entry) => entry.isFile() && !entry.parentPath.includes('node_modules'))
    .map((entry) => join(entry.parentPath, entry.name))
}

describe('the languages a project speaks', () => {
  it('reads them in the order given, the base first, in any case and each once', () => {
    expect(parseLanguages('PT-br, en,pt-BR')).toEqual(['pt-BR', 'en'])
    expect(parseLanguages('es-419')).toEqual(['es-419'])
  })

  it('refuses one Prumo does not translate, and none at all', () => {
    expect(() => parseLanguages('en,fr')).toThrow('Unknown language: fr')
    expect(() => parseLanguages(' , ')).toThrow('Unknown language: (none)')
  })

  it('asks for them outside a terminal, whatever the types', async () => {
    await expect(resolveAnswers(flags({}), undefined)).rejects.toThrow('Missing --languages <list>')
    await expect(
      resolveAnswers(flags({ types: 'web', signIn: undefined, noEmail: false }), undefined),
    ).rejects.toThrow('Missing --languages <list>')
    expect((await resolveAnswers(flags({ languages: 'es-419,en' }), undefined)).languages).toEqual([
      'es-419',
      'en',
    ])
  })

  it('asks whether it speaks one or several outside a terminal, and one means one', async () => {
    const neither = { multiLanguage: false, singleLanguage: false, languages: 'en' }

    await expect(resolveAnswers(flags(neither), undefined)).rejects.toThrow(
      'Missing --single-language or --multi-language',
    )
    await expect(
      resolveAnswers(flags({ ...neither, multiLanguage: true, singleLanguage: true }), undefined),
    ).rejects.toThrow('Choose --multi-language or --single-language, not both.')
    await expect(
      resolveAnswers(flags({ ...neither, singleLanguage: true, languages: 'pt-BR,en' }), undefined),
    ).rejects.toThrow('--single-language speaks one language')
    expect(
      await resolveAnswers(
        flags({ ...neither, singleLanguage: true, languages: 'pt-BR' }),
        undefined,
      ),
    ).toMatchObject({ multiLanguage: false, languages: ['pt-BR'] })
  })
})

describe('a generated project', () => {
  let root: string

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function project(answers: Partial<Answers>): Promise<string> {
    root = await mkdtemp(join(tmpdir(), 'prumo-languages-'))
    const target = join(root, 'acme')

    await generate({
      templates,
      knowledge,
      target,
      install: false,
      answers: {
        name: 'acme',
        types: ['api'],
        architecture: 'alone',
        multiTenant: false,
        multiLanguage: true,
        languages: ['en'],
        mcp: false,
        signIn: ['password'],
        email: false,
        social: [],
        ...answers,
      },
    })

    return target
  }

  it('keeps only its languages, in its order, checked against its base', async () => {
    const api = await project({ languages: ['pt-BR', 'es-419'] })
    const read = (path: string) => readFile(join(api, path), 'utf8')

    expect(existsSync(join(api, 'src/i18n/messages/en.ts'))).toBe(false)
    expect(existsSync(join(api, 'src/i18n/messages/pt-BR.ts'))).toBe(true)
    expect(await read('src/i18n/locales.ts')).toContain(
      "export const LOCALES = ['pt-BR', 'es-419'] as const",
    )
    expect(await read('src/i18n/messages/index.ts')).toContain('export type Messages = typeof ptBR')
    expect(await read('src/infra/http/hooks/locale.hook.ts')).not.toContain('z.locales.en')
    expect(
      await read('migrations/Migration20261005111545_create_user_profile_session.ts'),
    ).toContain(`"locale" text not null default 'pt-BR'`)

    for (const file of await files(api)) {
      expect(await readFile(file, 'utf8'), file).not.toMatch(/prumo:(end-)?(en|pt-BR|es-419)\b/)
    }
  })

  it('leaves no app of a workspace importing the list from a copy of its own, an Astro page neither', async () => {
    const target = await project({
      types: ['api', 'web', 'mobile'],
      apps: [
        { name: 'api', type: 'api' },
        { name: 'web', type: 'web', framework: 'vite' },
        { name: 'site', type: 'web', framework: 'next' },
        { name: 'press', type: 'web', framework: 'astro' },
        { name: 'mobile', type: 'mobile' },
      ],
      architecture: 'monorepo',
      languages: ['pt-BR', 'en'],
    })

    for (const file of await files(target)) {
      if (/\.(tsx?|astro)$/.test(file)) {
        expect(await readFile(file, 'utf8'), file).not.toContain("'@/i18n/locales'")
      }
    }
  })

  it('moves the languages of a workspace into the package every app imports them from', async () => {
    const target = await project({
      types: ['api', 'web'],
      architecture: 'monorepo',
      languages: ['es-419'],
    })
    const api = join(target, 'apps', 'api')

    expect(await readFile(join(target, 'packages/i18n/src/index.ts'), 'utf8')).toContain(
      "export const LOCALES = ['es-419'] as const",
    )
    expect(existsSync(join(api, 'src/i18n/locales.ts'))).toBe(false)
    expect(
      await readFile(join(api, 'src/domain/users/entities/profile.entity.ts'), 'utf8'),
    ).toContain("from '@app/i18n'")
    expect(
      JSON.parse(await readFile(join(api, 'package.json'), 'utf8')).dependencies,
    ).toMatchObject({ '@app/i18n': 'workspace:*' })
  })

  it('of one language writes its words where they are shown, and keeps nothing of the languages', async () => {
    const target = await project({
      types: ['api', 'web', 'mobile'],
      apps: [
        { name: 'api', type: 'api' },
        { name: 'web', type: 'web', framework: 'vite' },
        { name: 'site', type: 'web', framework: 'next' },
        { name: 'press', type: 'web', framework: 'astro' },
        { name: 'mobile', type: 'mobile' },
      ],
      architecture: 'monorepo',
      multiLanguage: false,
      languages: ['pt-BR'],
    })
    const read = (path: string) => readFile(join(target, path), 'utf8')

    expect(existsSync(join(target, 'packages/i18n'))).toBe(false)
    expect(existsSync(join(target, '.prumo/i18n'))).toBe(false)
    expect(existsSync(join(target, '.prumo/api/languages.md'))).toBe(false)
    expect(await read('.prumo/core/conventions.md')).toContain(
      "Write every word a person reads where it is shown, in the project's language",
    )
    expect(JSON.parse(await read('.prumo/config.json'))).toMatchObject({
      multiLanguage: false,
      languages: ['pt-BR'],
    })

    for (const app of ['api', 'web', 'site', 'press', 'mobile']) {
      expect(existsSync(join(target, 'apps', app, 'src/i18n')), app).toBe(false)
    }

    // The routes of a language are the app's routes, the words are Portuguese, and the errors carry their own.
    expect(existsSync(join(target, 'apps/site/src/app/(auth)/sign-in/page.tsx'))).toBe(true)
    expect(existsSync(join(target, 'apps/press/src/pages/sign-in.astro'))).toBe(true)
    expect(await read('apps/site/src/app/(auth)/sign-in/page.tsx')).toContain(
      "export const metadata: Metadata = { title: 'Entrar' }",
    )
    expect(await read('apps/api/src/domain/auth/errors/email-taken.error.ts')).toContain(
      "super('Já existe uma conta com este e-mail')",
    )
    expect(await read('apps/api/src/infra/http/app.ts')).toContain('z.config(z.locales.pt())')
    expect(
      await read('apps/api/migrations/Migration20261005111545_create_user_profile_session.ts'),
    ).not.toContain('"locale"')

    for (const file of await files(target)) {
      if (/\.(tsx?|astro)$/.test(file)) {
        expect(await readFile(file, 'utf8'), file).not.toMatch(
          /useMessages|messagesFor|@\/i18n\/|@app\/i18n|prumo:(end-)?(single|multi)-language/,
        )
      }
    }
  })
})
