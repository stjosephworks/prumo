import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Asker } from '../src/asker.ts'
import { generate } from '../src/generate.ts'
import { type Flags, resolveAnswers } from '../src/questions.ts'
import { cliVersion } from '../src/version.ts'

const templates = resolve(import.meta.dirname, '../../templates')
const knowledge = resolve(import.meta.dirname, '../../.prumo-templates')

const flags = (overrides: Partial<Flags>): Flags => ({
  name: 'acme',
  types: undefined,
  alone: false,
  monorepo: false,
  multiTenant: false,
  singleTenant: false,
  mcp: false,
  noMcp: false,
  ...overrides,
})

describe('resolveAnswers outside a terminal', () => {
  it('refuses a missing answer instead of guessing it', async () => {
    await expect(resolveAnswers(flags({}), undefined)).rejects.toThrow('Missing --types')
    await expect(resolveAnswers(flags({ types: 'api' }), undefined)).rejects.toThrow(
      '--multi-tenant',
    )
  })

  it('makes a workspace of several types and refuses --alone for them', async () => {
    const answers = await resolveAnswers(
      flags({ types: 'api,web', singleTenant: true, noMcp: true }),
      undefined,
    )

    expect(answers.architecture).toBe('monorepo')
    await expect(
      resolveAnswers(
        flags({ types: 'api,web', alone: true, singleTenant: true, noMcp: true }),
        undefined,
      ),
    ).rejects.toThrow('--alone holds a single type')
  })

  it('asks about MCP only when there is an api and a web to authorize through', async () => {
    await expect(
      resolveAnswers(flags({ types: 'api,web', singleTenant: true }), undefined),
    ).rejects.toThrow('--mcp or --no-mcp')
    await expect(
      resolveAnswers(flags({ types: 'api', singleTenant: true, mcp: true }), undefined),
    ).rejects.toThrow('--mcp needs both api and web')

    const answers = await resolveAnswers(flags({ types: 'api', singleTenant: true }), undefined)

    expect(answers.mcp).toBe(false)
  })

  it('does not ask a site whether it is multi-tenant, and refuses being told it is', async () => {
    const answers = await resolveAnswers(flags({ types: 'site' }), undefined)

    expect(answers).toMatchObject({ architecture: 'alone', multiTenant: false })
    await expect(
      resolveAnswers(flags({ types: 'site', multiTenant: true }), undefined),
    ).rejects.toThrow('--multi-tenant needs one of api, web, mobile')
  })

  it('refuses an empty --types', async () => {
    for (const types of ['', ',', ' , ']) {
      await expect(resolveAnswers(flags({ types }), undefined)).rejects.toThrow('--types is empty')
    }
  })

  it('refuses a name the workspace gives an app, or one npm would refuse', async () => {
    for (const name of ['api', 'web', 'mobile', 'site', `a${'b'.repeat(214)}`]) {
      await expect(resolveAnswers(flags({ name, types: 'site' }), undefined)).rejects.toMatchObject(
        { code: 'invalid_input' },
      )
    }
  })
})

describe('resolveAnswers in a terminal', () => {
  function scripted(answers: Partial<Asker & { asked: string[] }> = {}) {
    const asked: string[] = []
    const asker: Asker = {
      name: async () => {
        asked.push('name')
        return 'from-prompt'
      },
      types: async () => {
        asked.push('types')
        return ['api']
      },
      architecture: async () => {
        asked.push('architecture')
        return 'monorepo'
      },
      multiTenant: async () => {
        asked.push('multiTenant')
        return true
      },
      mcp: async () => {
        asked.push('mcp')
        return true
      },
      ...answers,
    }

    return { asker, asked }
  }

  it('asks only what the flags left open, in order', async () => {
    const { asker, asked } = scripted()

    const answers = await resolveAnswers(flags({ name: undefined }), asker)

    expect(asked).toEqual(['name', 'types', 'architecture', 'multiTenant'])
    expect(answers).toEqual({
      name: 'from-prompt',
      types: ['api'],
      architecture: 'monorepo',
      multiTenant: true,
      mcp: false,
      target: resolve('from-prompt'),
    })
  })

  it('skips a question a flag already answered', async () => {
    const { asker, asked } = scripted()

    const answers = await resolveAnswers(flags({ types: 'site', alone: true }), asker)

    expect(asked).toEqual([])
    expect(answers).toMatchObject({ name: 'acme', architecture: 'alone', multiTenant: false })
  })

  it('refuses a directory that cannot take the project before asking anything else', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prumo-answers-'))

    try {
      await mkdir(join(root, 'taken'))
      await writeFile(join(root, 'taken', 'file'), '')
      await writeFile(join(root, 'a-file'), '')

      for (const name of ['taken', 'a-file']) {
        const { asker, asked } = scripted()

        await expect(resolveAnswers(flags({ name }), asker, root)).rejects.toMatchObject({
          code: 'target_not_empty',
        })
        expect(asked).toEqual([])
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('takes `.` as the current directory, named after it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prumo-answers-'))
    const here = join(root, 'my-site')

    try {
      await mkdir(here)

      expect(
        await resolveAnswers(flags({ name: '.', types: 'site' }), undefined, here),
      ).toMatchObject({ name: 'my-site', target: here })
      await expect(
        resolveAnswers(flags({ name: '.', types: 'site' }), undefined, root),
      ).rejects.toThrow('taken from this directory')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not ask the architecture when several types decide it', async () => {
    const { asker, asked } = scripted()

    const answers = await resolveAnswers(flags({ types: 'api,mobile', singleTenant: true }), asker)

    expect(asked).toEqual([])
    expect(answers.architecture).toBe('monorepo')
  })
})

describe('generate', () => {
  let root: string

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('names an alone mobile app and gives it its own scheme', async () => {
    root = await mkdtemp(join(tmpdir(), 'prumo-new-'))
    const target = join(root, 'acme-app')

    await generate({
      templates,
      knowledge,
      target,
      install: false,
      answers: {
        name: 'acme-app',
        types: ['mobile'],
        architecture: 'alone',
        multiTenant: false,
        mcp: false,
      },
    })

    const app = JSON.parse(await readFile(join(target, 'app.json'), 'utf8'))
    const config = JSON.parse(await readFile(join(target, '.prumo/config.json'), 'utf8'))
    const index = await readFile(join(target, '.prumo/INDEX.md'), 'utf8')

    expect(app.expo).toMatchObject({ name: 'acme-app', slug: 'acme-app', scheme: 'acmeapp' })
    expect(JSON.parse(await readFile(join(target, 'package.json'), 'utf8')).name).toBe('acme-app')
    // The version that wrote it, so a tool can tell a project made by an older Prumo.
    expect(config).toEqual({
      prumo: cliVersion(),
      types: ['mobile'],
      architecture: 'alone',
      multiTenant: false,
      mcp: false,
    })
    expect(index).toContain('[mobile/storage.md](mobile/storage.md)')
    expect(index).toContain('[client/data.md](client/data.md)')
    expect(existsSync(join(target, '.prumo/api'))).toBe(false)
    expect(await readFile(join(target, 'CLAUDE.md'), 'utf8')).toBe('@AGENTS.md\n')
    expect(existsSync(join(target, '.git'))).toBe(true)
    expect(existsSync(join(target, '.githooks/install.mjs'))).toBe(true)
    expect(await readFile(join(target, '.env'), 'utf8')).toBe(
      await readFile(join(target, '.env.example'), 'utf8'),
    )
  })

  it('gives an alone API a local .env with a secret of its own', async () => {
    root = await mkdtemp(join(tmpdir(), 'prumo-new-'))
    const first = join(root, 'first')
    const second = join(root, 'second')

    for (const target of [first, second]) {
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
          mcp: false,
        },
      })
    }

    const secret = async (target: string) =>
      /^JWT_SECRET=(.*)$/m.exec(await readFile(join(target, '.env'), 'utf8'))?.[1]
    const example = await readFile(join(first, '.env.example'), 'utf8')
    const env = await readFile(join(first, '.env'), 'utf8')

    expect(await secret(first)).toMatch(/^[\w-]{43}$/)
    expect(await secret(first)).not.toBe(await secret(second))
    expect(env.replace(/^JWT_SECRET=.*$/m, '')).toBe(example.replace(/^JWT_SECRET=.*$/m, ''))
  })

  it('composes a multi-tenant workspace with every matching area', async () => {
    root = await mkdtemp(join(tmpdir(), 'prumo-new-'))
    const target = join(root, 'acme')

    await generate({
      templates,
      knowledge,
      target,
      install: false,
      answers: {
        name: 'acme',
        types: ['api', 'mobile'],
        architecture: 'monorepo',
        multiTenant: true,
        mcp: false,
      },
    })

    const app = JSON.parse(await readFile(join(target, 'apps/mobile/app.json'), 'utf8'))

    for (const area of [
      'core',
      'api',
      'database',
      'client',
      'mobile',
      'monorepo',
      'multi-tenancy',
    ]) {
      expect(existsSync(join(target, '.prumo', area))).toBe(true)
    }
    expect(existsSync(join(target, '.prumo/web'))).toBe(false)
    expect(existsSync(join(target, '.githooks/install.mjs'))).toBe(true)
    expect(existsSync(join(target, 'apps/api/.githooks'))).toBe(false)
    expect(await readFile(join(target, 'apps/api/docker-compose.yml'), 'utf8')).toMatch(
      /^name: acme$/m,
    )
    expect(await readFile(join(target, 'apps/mobile/.env'), 'utf8')).toBe(
      await readFile(join(target, 'apps/mobile/.env.example'), 'utf8'),
    )
    expect(existsSync(join(target, '.env'))).toBe(false)
    expect(app.expo.scheme).toBe('acme')
    expect(JSON.parse(await readFile(join(target, 'package.json'), 'utf8')).name).toBe('acme')
  })

  it('gives a site the .env it needs to pick its port', async () => {
    root = await mkdtemp(join(tmpdir(), 'prumo-new-'))
    const target = join(root, 'acme')

    await generate({
      templates,
      knowledge,
      target,
      install: false,
      answers: {
        name: 'acme',
        types: ['site'],
        architecture: 'alone',
        multiTenant: false,
        mcp: false,
      },
    })

    expect(await readFile(join(target, '.env'), 'utf8')).toMatch(/^SITE_PORT=3200$/m)
  })

  it('refuses to write into a directory that is not empty', async () => {
    root = await mkdtemp(join(tmpdir(), 'prumo-new-'))

    await expect(
      generate({
        templates,
        knowledge,
        target: resolve(import.meta.dirname, '..'),
        install: false,
        answers: {
          name: 'bin',
          types: ['site'],
          architecture: 'alone',
          multiTenant: false,
          mcp: false,
        },
      }),
    ).rejects.toThrow('not empty')
  })
})

describe('generate when it fails', () => {
  let root: string

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  // A site template without its README fails after the files are copied, the way a failed install would.
  async function brokenTemplates(): Promise<string> {
    const broken = join(root, 'templates')

    await mkdir(join(broken, 'site'), { recursive: true })
    await writeFile(join(broken, 'site', 'package.json'), '{ "name": "site" }\n')

    return broken
  }

  const answers = {
    name: 'acme',
    types: ['site' as const],
    architecture: 'alone' as const,
    multiTenant: false,
    mcp: false,
  }

  it('removes the directory it created', async () => {
    root = await mkdtemp(join(tmpdir(), 'prumo-broken-'))
    const target = join(root, 'acme')

    await expect(
      generate({ templates: await brokenTemplates(), knowledge, target, answers, install: false }),
    ).rejects.toThrow()
    expect(existsSync(target)).toBe(false)
  })

  it('empties, and keeps, the empty directory it was given', async () => {
    root = await mkdtemp(join(tmpdir(), 'prumo-broken-'))
    const target = join(root, 'acme')

    await mkdir(target)
    await expect(
      generate({ templates: await brokenTemplates(), knowledge, target, answers, install: false }),
    ).rejects.toThrow()
    expect(existsSync(target)).toBe(true)
    expect(await readdir(target)).toEqual([])
  })
})
