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
  apps: undefined,
  alone: false,
  monorepo: false,
  multiTenant: false,
  singleTenant: false,
  languages: 'en',
  mcp: false,
  noMcp: false,
  signIn: undefined,
  email: false,
  noEmail: false,
  social: undefined,
  noSocial: false,
  ...overrides,
})

describe('resolveAnswers outside a terminal', () => {
  it('refuses a missing answer instead of guessing it', async () => {
    await expect(resolveAnswers(flags({}), undefined)).rejects.toThrow('Missing --types')
    await expect(
      resolveAnswers(flags({ signIn: 'password', types: 'api', alone: true }), undefined),
    ).rejects.toThrow('--multi-tenant')
  })

  it('refuses a single type without --alone or --monorepo, and lays it out as told', async () => {
    const rest = { singleTenant: true, noEmail: true }

    await expect(
      resolveAnswers(flags({ signIn: 'password', types: 'api', ...rest }), undefined),
    ).rejects.toMatchObject({
      code: 'needs_input',
      message: expect.stringContaining('Missing --alone or --monorepo'),
    })
    expect(
      (
        await resolveAnswers(
          flags({ signIn: 'password', types: 'api', alone: true, ...rest }),
          undefined,
        )
      ).architecture,
    ).toBe('alone')
    expect(
      (
        await resolveAnswers(
          flags({ signIn: 'password', types: 'api', monorepo: true, ...rest }),
          undefined,
        )
      ).architecture,
    ).toBe('monorepo')
  })

  it('makes a workspace of several types and refuses --alone for them', async () => {
    const answers = await resolveAnswers(
      flags({
        signIn: 'password',
        types: 'api,web',
        singleTenant: true,
        noMcp: true,
        noEmail: true,
        noSocial: true,
      }),
      undefined,
    )

    expect(answers.architecture).toBe('monorepo')
    await expect(
      resolveAnswers(
        flags({
          signIn: 'password',
          types: 'api,web',
          alone: true,
          singleTenant: true,
          noMcp: true,
          noEmail: true,
          noSocial: true,
        }),
        undefined,
      ),
    ).rejects.toThrow('--alone holds a single type')
  })

  it('asks about MCP only when there is an api and a web to authorize through', async () => {
    await expect(
      resolveAnswers(
        flags({ signIn: 'password', types: 'api,web', singleTenant: true }),
        undefined,
      ),
    ).rejects.toThrow('--mcp or --no-mcp')
    await expect(
      resolveAnswers(
        flags({ signIn: 'password', types: 'api', alone: true, singleTenant: true, mcp: true }),
        undefined,
      ),
    ).rejects.toThrow('--mcp needs both api and web')

    const answers = await resolveAnswers(
      flags({ signIn: 'password', types: 'api', alone: true, singleTenant: true, noEmail: true }),
      undefined,
    )

    expect(answers.mcp).toBe(false)
  })

  it('reads a web framework from --types, and gives Vite to a web that names none', async () => {
    const rest = { singleTenant: true, noEmail: true, noMcp: true, noSocial: true }

    expect(
      (await resolveAnswers(flags({ types: 'web:next', alone: true, ...rest }), undefined)).apps,
    ).toEqual([{ name: 'web', type: 'web', framework: 'next' }])
    expect(
      (
        await resolveAnswers(
          flags({ signIn: 'password', types: 'api,web', apps: ['blog=web:next'], ...rest }),
          undefined,
        )
      ).apps,
    ).toEqual([
      { name: 'api', type: 'api' },
      { name: 'web', type: 'web', framework: 'vite' },
      { name: 'blog', type: 'web', framework: 'next' },
    ])
    await expect(resolveAnswers(flags({ types: 'site', alone: true }), undefined)).rejects.toThrow(
      'site became web:next',
    )
    await expect(
      resolveAnswers(flags({ types: 'web,web:next', ...rest }), undefined),
    ).rejects.toThrow('--app <name>=web')
  })

  it('reads the providers from --social and refuses what it cannot honour', async () => {
    const web = {
      types: 'api,web',
      signIn: 'password',
      singleTenant: true,
      noMcp: true,
      noEmail: true,
    }
    const answers = await resolveAnswers(flags({ ...web, social: 'apple, google' }), undefined)

    expect(answers.social).toEqual(['apple', 'google'])
    expect(answers.warnings).toEqual([expect.stringContaining('--email avoids it')])
    expect(
      (
        await resolveAnswers(
          flags({ ...web, noEmail: false, email: true, social: 'apple' }),
          undefined,
        )
      ).warnings,
    ).toEqual([])
    await expect(resolveAnswers(flags({ ...web, social: 'github' }), undefined)).rejects.toThrow(
      'Unknown provider: github',
    )
    await expect(
      resolveAnswers(
        flags({
          signIn: 'password',
          types: 'api',
          alone: true,
          singleTenant: true,
          noEmail: true,
          social: 'google',
        }),
        undefined,
      ),
    ).rejects.toThrow('--social needs api, and web or mobile')
    await expect(
      resolveAnswers(
        flags({ types: 'web:next', alone: true, singleTenant: true, email: true }),
        undefined,
      ),
    ).rejects.toThrow('--email needs api')
  })

  it('refuses an empty --types', async () => {
    for (const types of ['', ',', ' , ']) {
      await expect(resolveAnswers(flags({ types }), undefined)).rejects.toThrow('--types is empty')
    }
  })

  it('refuses a name the workspace gives an app, or one npm would refuse', async () => {
    for (const name of ['api', 'web', 'mobile', `a${'b'.repeat(214)}`]) {
      await expect(resolveAnswers(flags({ name, types: 'web' }), undefined)).rejects.toMatchObject({
        code: 'invalid_input',
      })
    }
  })
})

describe('resolveAnswers with apps named on purpose', () => {
  const rest = { singleTenant: true, noMcp: true, noEmail: true, noSocial: true }

  it('adds each --app after the types, and makes a workspace of them', async () => {
    const answers = await resolveAnswers(
      flags({ signIn: 'password', types: 'api,web', apps: ['backoffice=web'], ...rest }),
      undefined,
    )

    expect(answers.apps).toEqual([
      { name: 'api', type: 'api' },
      { name: 'web', type: 'web', framework: 'vite' },
      { name: 'backoffice', type: 'web', framework: 'vite' },
    ])
    expect(answers.types).toEqual(['api', 'web'])
    expect(answers.architecture).toBe('monorepo')
  })

  it('renames an app when its type is left out of --types, even when it is the only one', async () => {
    const answers = await resolveAnswers(
      flags({ apps: ['admin=web'], singleTenant: true }),
      undefined,
    )

    expect(answers.apps).toEqual([{ name: 'admin', type: 'web', framework: 'vite' }])
    expect(answers.types).toEqual(['web'])
    expect(answers.architecture).toBe('monorepo')
  })

  it('refuses --alone, a second api and a name taken', async () => {
    await expect(
      resolveAnswers(flags({ apps: ['admin=web'], alone: true, ...rest }), undefined),
    ).rejects.toThrow('--app names an app inside a workspace')
    await expect(
      resolveAnswers(
        flags({ signIn: 'password', types: 'api', apps: ['worker=api'], ...rest }),
        undefined,
      ),
    ).rejects.toMatchObject({ code: 'invalid_app', message: expect.stringContaining('one api') })
    await expect(
      resolveAnswers(flags({ types: 'web', apps: ['web=web'], ...rest }), undefined),
    ).rejects.toThrow('Another app is already named "web"')
    await expect(
      resolveAnswers(flags({ types: 'web', apps: ['acme=web:next'], ...rest }), undefined),
    ).rejects.toThrow('project’s name')
  })

  it('lets MCP authorize through a web app that was renamed', async () => {
    const answers = await resolveAnswers(
      flags({
        signIn: 'password',
        types: 'api',
        apps: ['admin=web'],
        ...rest,
        noMcp: false,
        mcp: true,
      }),
      undefined,
    )

    expect(answers.mcp).toBe(true)
  })
})

describe('resolveAnswers for how people sign in', () => {
  const rest = { singleTenant: true, noMcp: true, noSocial: true }

  it('reads the methods from --sign-in, any of them, and asks --email only with a password', async () => {
    const both = await resolveAnswers(
      flags({ types: 'api', alone: true, signIn: 'email-code, password', email: true, ...rest }),
      undefined,
    )
    const byCode = await resolveAnswers(
      flags({ types: 'api', alone: true, signIn: 'email-code', ...rest }),
      undefined,
    )

    expect(both).toMatchObject({ signIn: ['email-code', 'password'], email: true })
    expect(byCode).toMatchObject({ signIn: ['email-code'], email: false })
  })

  it('refuses no method, an unknown one, --email without a password, and --sign-in without an api', async () => {
    const api = { types: 'api', alone: true, ...rest }

    await expect(resolveAnswers(flags({ ...api, signIn: '' }), undefined)).rejects.toThrow(
      'Unknown sign-in method: (none)',
    )
    await expect(
      resolveAnswers(flags({ ...api, signIn: 'magic-link' }), undefined),
    ).rejects.toThrow('Unknown sign-in method: magic-link')
    await expect(
      resolveAnswers(flags({ ...api, signIn: 'email-code', email: true }), undefined),
    ).rejects.toThrow('it needs password in --sign-in')
    await expect(
      resolveAnswers(flags({ types: 'web', alone: true, signIn: 'password', ...rest }), undefined),
    ).rejects.toThrow('--sign-in needs api')
    await expect(resolveAnswers(flags(api), undefined)).rejects.toThrow('Missing --sign-in')
  })

  it('warns that texts go to the log and to US only, until both are set', async () => {
    const answers = await resolveAnswers(
      flags({ types: 'api', alone: true, signIn: 'phone-code', ...rest }),
      undefined,
    )

    expect(answers.warnings).toEqual([expect.stringContaining('SMS_COUNTRIES')])
  })

  it('warns a passwordless mobile app that store review needs an agreed code', async () => {
    const answers = await resolveAnswers(
      flags({ types: 'api,mobile', signIn: 'email-code', ...rest }),
      undefined,
    )

    expect(answers.warnings).toEqual([expect.stringContaining('REVIEW_SIGN_IN')])
  })

  it('keeps a project without an api on the password screens it has always had', async () => {
    const answers = await resolveAnswers(flags({ types: 'web', alone: true, ...rest }), undefined)

    expect(answers.signIn).toEqual(['password'])
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
      apps: async (defaults) => {
        asked.push('apps')
        return defaults
      },
      framework: async (app) => {
        asked.push(`framework ${app}`)
        return 'next'
      },
      multiTenant: async () => {
        asked.push('multiTenant')
        return true
      },
      languages: async () => {
        asked.push('languages')
        return ['pt-BR', 'en']
      },
      mcp: async () => {
        asked.push('mcp')
        return true
      },
      signIn: async () => {
        asked.push('signIn')
        return ['password']
      },
      email: async () => {
        asked.push('email')
        return true
      },
      social: async () => {
        asked.push('social')
        return []
      },
      ...answers,
    }

    return { asker, asked }
  }

  it('asks only what the flags left open, in order', async () => {
    const { asker, asked } = scripted()

    const answers = await resolveAnswers(flags({ name: undefined }), asker)

    expect(asked).toEqual([
      'name',
      'types',
      'architecture',
      'apps',
      'multiTenant',
      'signIn',
      'email',
    ])
    expect(answers).toEqual({
      name: 'from-prompt',
      types: ['api'],
      apps: [{ name: 'api', type: 'api' }],
      architecture: 'monorepo',
      multiTenant: true,
      languages: ['en'],
      mcp: false,
      signIn: ['password'],
      email: true,
      social: [],
      target: resolve('from-prompt'),
      warnings: [],
    })
  })

  it('asks the framework of every web app, after the apps are known', async () => {
    const { asker, asked } = scripted({
      types: async () => ['api', 'web'],
      apps: async (defaults) => [...defaults, { name: 'blog', type: 'web' }],
    })

    const answers = await resolveAnswers(
      flags({ signIn: 'password', singleTenant: true, noMcp: true, noEmail: true, noSocial: true }),
      asker,
    )

    expect(asked).toEqual(['framework web', 'framework blog'])
    expect(answers.apps).toEqual([
      { name: 'api', type: 'api' },
      { name: 'web', type: 'web', framework: 'next' },
      { name: 'blog', type: 'web', framework: 'next' },
    ])
  })

  it('skips a question a flag already answered', async () => {
    const { asker, asked } = scripted()

    const answers = await resolveAnswers(
      flags({ types: 'web:next', alone: true, singleTenant: true }),
      asker,
    )

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
    // Named on purpose: mkdtemp's random suffix is sometimes a valid project name, sometimes not.
    const invalid = join(root, 'Not_A_Name')

    try {
      await mkdir(here)
      await mkdir(invalid)

      expect(
        await resolveAnswers(
          flags({ name: '.', types: 'web', alone: true, singleTenant: true }),
          undefined,
          here,
        ),
      ).toMatchObject({ name: 'my-site', target: here })
      await expect(
        resolveAnswers(flags({ name: '.', types: 'web' }), undefined, invalid),
      ).rejects.toThrow('taken from this directory')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('asks about email with an api, and about social sign-in only when a client can come back', async () => {
    const apiOnly = scripted()
    const withMobile = scripted({
      social: async () => {
        withMobile.asked.push('social')
        return ['google']
      },
    })

    await resolveAnswers(
      flags({ signIn: 'password', types: 'api', singleTenant: true }),
      apiOnly.asker,
    )
    const answers = await resolveAnswers(
      flags({ signIn: 'password', types: 'api,mobile', singleTenant: true }),
      withMobile.asker,
    )

    expect(apiOnly.asked).toEqual(['architecture', 'email'])
    expect(withMobile.asked).toEqual(['email', 'social'])
    // Google on mobile without Apple is allowed, and named for what the App Store will ask.
    expect(answers.warnings).toEqual([expect.stringContaining('Guideline 4.8')])
  })

  it('does not ask the architecture when several types decide it', async () => {
    const { asker, asked } = scripted()

    const answers = await resolveAnswers(
      flags({
        signIn: 'password',
        types: 'api,mobile',
        singleTenant: true,
        noEmail: true,
        noSocial: true,
      }),
      asker,
    )

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
        languages: ['en'],
        mcp: false,
        signIn: ['password'],
        email: false,
        social: [],
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
      apps: [{ name: 'mobile', type: 'mobile' }],
      architecture: 'alone',
      multiTenant: false,
      languages: ['en'],
      mcp: false,
      signIn: ['password'],
      email: false,
      social: [],
    })
    expect(index).toContain('[mobile/storage.md](mobile/storage.md)')
    expect(index).toContain('[client/data.md](client/data.md)')
    expect(existsSync(join(target, '.prumo/api'))).toBe(false)
    expect(await readFile(join(target, 'CLAUDE.md'), 'utf8')).toBe('@AGENTS.md\n')
    expect(existsSync(join(target, '.git'))).toBe(true)
    expect(await readFile(join(target, '.git/HEAD'), 'utf8')).toBe('ref: refs/heads/main\n')
    expect(existsSync(join(target, '.githooks/install.mjs'))).toBe(true)
    expect(existsSync(join(target, '.github/workflows/flow.yml'))).toBe(true)
    expect(existsSync(join(target, '.github/rulesets/project.json'))).toBe(true)
    expect(await readFile(join(target, 'README.md'), 'utf8')).toContain('## Branches')
    expect(index).toContain('[core/git.md](core/git.md)')
    expect(await readFile(join(target, '.gitattributes'), 'utf8')).toContain('eol=lf')
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
          languages: ['en'],
          mcp: false,
          signIn: ['password'],
          email: false,
          social: [],
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
        languages: ['en'],
        mcp: false,
        signIn: ['password'],
        email: false,
        social: [],
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
    expect(existsSync(join(target, '.github/workflows/flow.yml'))).toBe(true)
    expect(existsSync(join(target, 'apps/api/.github'))).toBe(false)
    expect(await readFile(join(target, 'README.md'), 'utf8')).toContain('## Branches')
    expect(await readFile(join(target, 'apps/mobile/README.md'), 'utf8')).not.toContain(
      '## Branches',
    )
    expect(await readFile(join(target, '.gitattributes'), 'utf8')).toContain('eol=lf')
    expect(existsSync(join(target, 'apps/api/.gitattributes'))).toBe(false)
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

  it('generates apps named on purpose, and records them for every tool that reads the project', async () => {
    root = await mkdtemp(join(tmpdir(), 'prumo-new-'))
    const target = join(root, 'acme')
    const apps = [
      { name: 'server', type: 'api' },
      { name: 'web', type: 'web' },
      { name: 'backoffice', type: 'web' },
    ] as const

    await generate({
      templates,
      knowledge,
      target,
      install: false,
      answers: {
        name: 'acme',
        types: ['api', 'web'],
        apps: [...apps],
        architecture: 'monorepo',
        multiTenant: false,
        languages: ['en'],
        mcp: true,
        signIn: ['password'],
        email: false,
        social: ['google'],
      },
    })

    const config = JSON.parse(await readFile(join(target, '.prumo/config.json'), 'utf8'))
    const serverEnv = await readFile(join(target, 'apps/server/.env'), 'utf8')

    expect(config.apps).toEqual(apps)
    expect(serverEnv).toMatch(/^JWT_SECRET=[\w-]{43}$/m)
    expect(serverEnv).toMatch(/^WEB_ORIGIN=http:\/\/localhost:5173,http:\/\/localhost:5174$/m)
    expect(await readFile(join(target, 'apps/server/docker-compose.yml'), 'utf8')).toMatch(
      /^name: acme$/m,
    )
    expect(await readFile(join(target, 'apps/backoffice/.env'), 'utf8')).toMatch(/^WEB_PORT=5174$/m)
    // MCP's consent page ships with every web app; the API opens it on the first.
    expect(existsSync(join(target, 'apps/backoffice/src/routes/_authenticated/consent.tsx'))).toBe(
      true,
    )
  })

  it('gives a web app on Next the .env it needs to pick its port, and records its framework', async () => {
    root = await mkdtemp(join(tmpdir(), 'prumo-new-'))
    const target = join(root, 'acme')

    await generate({
      templates,
      knowledge,
      target,
      install: false,
      answers: {
        name: 'acme',
        types: ['web'],
        apps: [{ name: 'web', type: 'web', framework: 'next' }],
        architecture: 'alone',
        multiTenant: false,
        languages: ['en'],
        mcp: false,
        signIn: ['password'],
        email: false,
        social: [],
      },
    })

    expect(await readFile(join(target, '.env'), 'utf8')).toMatch(/^WEB_PORT=3200$/m)
    expect(existsSync(join(target, 'next.config.ts'))).toBe(true)
    expect(existsSync(join(target, '.prumo/web-next'))).toBe(true)
    expect(existsSync(join(target, '.prumo/web/components.md'))).toBe(true)
    expect(existsSync(join(target, '.prumo/web-vite'))).toBe(false)
    expect(JSON.parse(await readFile(join(target, '.prumo/config.json'), 'utf8')).apps).toEqual([
      { name: 'web', type: 'web', framework: 'next' },
    ])
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
          types: ['web'],
          architecture: 'alone',
          multiTenant: false,
          languages: ['en'],
          mcp: false,
          signIn: ['password'],
          email: false,
          social: [],
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

  // A web template without its README fails after the files are copied, the way a failed install would.
  async function brokenTemplates(): Promise<string> {
    const broken = join(root, 'templates')

    await mkdir(join(broken, 'web-vite'), { recursive: true })
    await writeFile(join(broken, 'web-vite', 'package.json'), '{ "name": "web" }\n')

    return broken
  }

  const answers = {
    name: 'acme',
    types: ['web' as const],
    architecture: 'alone' as const,
    multiTenant: false,
    languages: ['en' as const],
    mcp: false,
    signIn: ['password' as const],
    email: false,
    social: [],
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
