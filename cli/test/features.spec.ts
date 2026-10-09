import { existsSync } from 'node:fs'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cutFeature, FEATURES } from '../src/features.ts'
import { generate } from '../src/generate.ts'

const templates = resolve(import.meta.dirname, '../../templates')
const knowledge = resolve(import.meta.dirname, '../../.prumo-templates')

describe('cutFeature', () => {
  const source = [
    "import { mcp } from 'mcp' // prumo:mcp",
    "import { kept } from 'kept'",
    '// prumo:mcp',
    'mcpOnly()',
    '// prumo:end-mcp',
    'always()',
  ].join('\n')

  it('removes every marked line and block when MCP is off', () => {
    expect(cutFeature(source, 'mcp', false)).toBe(
      ["import { kept } from 'kept'", 'always()'].join('\n'),
    )
  })

  it('removes only the markers when MCP is on', () => {
    expect(cutFeature(source, 'mcp', true)).toBe(
      ["import { mcp } from 'mcp'", "import { kept } from 'kept'", 'mcpOnly()', 'always()'].join(
        '\n',
      ),
    )
  })

  it('refuses a block left open', () => {
    expect(() => cutFeature('// prumo:mcp\nx()', 'mcp', false)).toThrow('open')
  })

  it('reads a block marked in JSX', () => {
    const jsx = ['<p>a</p>', '{/* prumo:email */}', '<p>b</p>', '{/* prumo:end-email */}'].join(
      '\n',
    )

    expect(cutFeature(jsx, 'email', false)).toBe('<p>a</p>')
    expect(cutFeature(jsx, 'email', true)).toBe(['<p>a</p>', '<p>b</p>'].join('\n'))
  })

  it('reads a block and a line marked in an env file', () => {
    const env = [
      'A=1',
      '# prumo:google',
      'GOOGLE_ID=',
      '# prumo:end-google',
      'B=2 # prumo:apple',
    ].join('\n')

    expect(cutFeature(env, 'google', false)).toBe(['A=1', 'B=2 # prumo:apple'].join('\n'))
    expect(cutFeature(cutFeature(env, 'google', true), 'apple', true)).toBe(
      ['A=1', 'GOOGLE_ID=', 'B=2'].join('\n'),
    )
  })

  it('reads a block marked in Markdown', () => {
    const readme = [
      'A.',
      '<!-- prumo:email -->',
      '',
      'B.',
      '<!-- prumo:end-email -->',
      '',
      'C.',
    ].join('\n')

    expect(cutFeature(readme, 'email', false)).toBe(['A.', '', 'C.'].join('\n'))
    expect(cutFeature(readme, 'email', true)).toBe(['A.', '', 'B.', '', 'C.'].join('\n'))
  })

  it('cuts only the feature it is asked to', () => {
    const mixed = ['a() // prumo:email', 'b() // prumo:google', 'c()'].join('\n')

    expect(cutFeature(mixed, 'email', false)).toBe(['b() // prumo:google', 'c()'].join('\n'))
  })
})

// Every README a workspace holds: the root's and each app's.
async function readmes(target: string): Promise<string> {
  const apps = await readdir(join(target, 'apps'))
  const paths = [
    join(target, 'README.md'),
    ...apps.map((app) => join(target, 'apps', app, 'README.md')),
  ]

  return (await Promise.all(paths.map((path) => readFile(path, 'utf8')))).join('\n')
}

describe('generate with and without MCP', () => {
  let root: string

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function workspace(mcp: boolean): Promise<string> {
    root = await mkdtemp(join(tmpdir(), 'prumo-mcp-'))
    const target = join(root, 'acme')

    await generate({
      templates,
      knowledge,
      target,
      install: false,
      answers: {
        name: 'acme',
        types: ['api', 'web'],
        architecture: 'monorepo',
        multiTenant: false,
        mcp,
        email: false,
        social: [],
      },
    })

    return target
  }

  async function everything(target: string): Promise<string> {
    const entries = await readdir(join(target, 'apps'), { withFileTypes: true, recursive: true })
    const texts = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && /\.(tsx?|json)$/.test(entry.name))
        .map((entry) => readFile(join(entry.parentPath, entry.name), 'utf8')),
    )

    return texts.join('\n')
  }

  it('leaves out the server, the consent page, their packages and every marker', async () => {
    const target = await workspace(false)
    const text = await everything(target)

    expect(existsSync(join(target, 'apps/api/src/infra/mcp'))).toBe(false)
    expect(existsSync(join(target, 'apps/api/src/domain/oauth'))).toBe(false)
    expect(existsSync(join(target, 'apps/web/src/routes/_authenticated/consent.tsx'))).toBe(false)
    expect(await readdir(join(target, 'apps/api/migrations'))).toHaveLength(1)
    expect(text).not.toContain('prumo:')
    expect(text).not.toContain('@/domain/oauth')
    expect(text).not.toContain('@modelcontextprotocol')
    expect(await readFile(join(target, 'pnpm-workspace.yaml'), 'utf8')).not.toContain(
      '@modelcontextprotocol',
    )
    expect(existsSync(join(target, '.prumo/mcp'))).toBe(false)
    expect(await readmes(target)).not.toMatch(/prumo:|\/api\/mcp/)
  })

  it('keeps all of it without a marker, and says so in .prumo', async () => {
    const target = await workspace(true)
    const text = await everything(target)
    const config = JSON.parse(await readFile(join(target, '.prumo/config.json'), 'utf8'))

    expect(existsSync(join(target, 'apps/api/src/infra/mcp/mcp.server.ts'))).toBe(true)
    expect(existsSync(join(target, 'apps/web/src/routes/_authenticated/consent.tsx'))).toBe(true)
    expect(text).not.toContain('prumo:')
    expect(text).toContain("from '@modelcontextprotocol/server'")
    expect(existsSync(join(target, 'apps/api/src/domain/oauth'))).toBe(true)
    expect(await readdir(join(target, 'apps/api/migrations'))).toHaveLength(2)
    expect(config.mcp).toBe(true)
    expect(existsSync(join(target, '.prumo/mcp/server.md'))).toBe(true)
    expect(await readmes(target)).toContain('`/api/mcp`')
    expect(await readmes(target)).not.toContain('prumo:')
  })
})

describe('the markers in the templates', () => {
  // A marker at the end of a line cuts that line alone. On the last line of an import or a call split over several,
  // it would cut the closing line and leave the rest broken, in a project nobody generated in this repository.
  it('end only lines that stand on their own', async () => {
    const entries = await readdir(templates, { withFileTypes: true, recursive: true })
    const files = entries.filter(
      (entry) =>
        entry.isFile() &&
        /\.(tsx?|example)$/.test(entry.name) &&
        !entry.parentPath.includes('node_modules'),
    )

    for (const entry of files) {
      const path = join(entry.parentPath, entry.name)
      const lines = (await readFile(path, 'utf8')).split('\n')

      for (const line of lines.filter((each) => /(\/\/|#) prumo:[a-z-]+$/.test(each))) {
        expect(/^\s*[}\])]/.test(line), `${path}: ${line.trim()}`).toBe(false)
      }
    }
  })
})

describe('the cut lists', () => {
  // A path that no longer exists would be cut from nothing, and what it named would ship without its feature.
  it('name only paths the templates have', () => {
    for (const [feature, spec] of Object.entries(FEATURES)) {
      for (const [type, paths] of Object.entries(spec.files)) {
        for (const path of paths ?? []) {
          expect(existsSync(join(templates, type, path)), `${feature}: ${type}/${path}`).toBe(true)
        }
      }
    }
  })
})

describe('generate with social sign-in', () => {
  let root: string

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function workspace(types: ('api' | 'web' | 'mobile')[], social: ('google' | 'apple')[]) {
    root = await mkdtemp(join(tmpdir(), 'prumo-social-'))
    const target = join(root, 'acme')

    await generate({
      templates,
      knowledge,
      target,
      install: false,
      answers: {
        name: 'acme',
        types,
        architecture: 'monorepo',
        multiTenant: false,
        mcp: false,
        email: false,
        social,
      },
    })

    return target
  }

  it('keeps the provider chosen, cuts the other, and sends the app back by its own scheme', async () => {
    const target = await workspace(['api', 'web', 'mobile'], ['google'])
    const env = await readFile(join(target, 'apps/api/.env'), 'utf8')
    const adapter = await readFile(
      join(target, 'apps/api/src/infra/social/openid-identity-providers.adapter.ts'),
      'utf8',
    )
    const buttons = await readFile(
      join(target, 'apps/web/src/features/auth/social-buttons.tsx'),
      'utf8',
    )

    expect(await readmes(target)).toContain('/api/auth/social/<provider>')
    expect(await readmes(target)).not.toMatch(/prumo:|\[mail\] to/)
    expect(env).toMatch(/^MOBILE_APP_SCHEME=acme$/m)
    expect(env).toContain('GOOGLE_CLIENT_ID')
    expect(env).not.toContain('APPLE_')
    expect(adapter).toContain("case 'google'")
    expect(adapter).not.toContain("case 'apple'")
    expect(buttons).toContain('Continue with Google')
    expect(buttons).not.toContain('Continue with Apple')
    expect(await readdir(join(target, 'apps/api/migrations'))).toHaveLength(2)
  })

  it('leaves no mobile scheme without a mobile app, and nothing social without the answer', async () => {
    const withWeb = await workspace(['api', 'web'], ['apple'])

    expect(await readFile(join(withWeb, 'apps/api/.env'), 'utf8')).not.toContain(
      'MOBILE_APP_SCHEME',
    )
    await rm(root, { recursive: true, force: true })

    const without = await workspace(['api', 'web'], [])
    const env = await readFile(join(without, 'apps/api/.env.example'), 'utf8')

    expect(env).not.toMatch(/MOBILE_APP_SCHEME|GOOGLE_|APPLE_|prumo:/)
    expect(await readmes(without)).not.toMatch(/prumo:|\/api\/auth\/social/)
    expect(existsSync(join(without, 'apps/api/src/infra/social'))).toBe(false)
    expect(existsSync(join(without, 'apps/web/src/features/auth/social-buttons.tsx'))).toBe(false)
    expect(await readFile(join(without, 'apps/api/package.json'), 'utf8')).not.toContain(
      'openid-client',
    )
  })
})

describe('generate with email', () => {
  let root: string

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('tells every README where the code is read, and the alone API too', async () => {
    root = await mkdtemp(join(tmpdir(), 'prumo-email-'))
    const answers = { multiTenant: false, mcp: false, email: true, social: [] }

    await generate({
      templates,
      knowledge,
      target: join(root, 'acme'),
      install: false,
      answers: {
        ...answers,
        name: 'acme',
        types: ['api', 'web', 'mobile'],
        architecture: 'monorepo',
      },
    })
    await generate({
      templates,
      knowledge,
      target: join(root, 'solo'),
      install: false,
      answers: { ...answers, name: 'solo', types: ['api'], architecture: 'alone' },
    })

    for (const readme of [
      'acme/README.md',
      'acme/apps/api/README.md',
      'acme/apps/web/README.md',
      'acme/apps/mobile/README.md',
      'solo/README.md',
    ]) {
      const text = await readFile(join(root, readme), 'utf8')

      expect(text, readme).toContain('`[mail] to`')
      expect(text, readme).not.toMatch(/prumo:|\n\n\n/)
    }
  })
})
