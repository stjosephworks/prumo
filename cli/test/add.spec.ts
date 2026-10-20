import { existsSync } from 'node:fs'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { addApp } from '../src/add.ts'
import type { App } from '../src/apps.ts'
import type { Answers } from '../src/context.ts'
import { generate } from '../src/generate.ts'
import { cliVersion } from '../src/version.ts'

const templates = resolve(import.meta.dirname, '../../templates')
const knowledge = resolve(import.meta.dirname, '../../.prumo-templates')

describe('prumo add', () => {
  let root: string

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function workspace(answers: Partial<Answers> = {}) {
    root = await mkdtemp(join(tmpdir(), 'prumo-add-'))
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
        mcp: false,
        email: false,
        social: [],
        ...answers,
      },
    })

    return target
  }

  const read = (path: string) => readFile(path, 'utf8')
  const json = async (path: string) => JSON.parse(await read(path))
  const add = (cwd: string, type: App['type'], name?: string, assets = { templates, knowledge }) =>
    addApp({ ...assets, cwd, type, name, install: false })

  it('adds a second web app beside the first, trusted by the api and sharing its contract', async () => {
    const target = await workspace()
    // The api moved since it was generated: the new app points at where it answers now.
    await writeFile(
      join(target, 'apps/api/.env'),
      (await read(join(target, 'apps/api/.env'))).replace(
        /^API_URL=.*$/m,
        'API_URL=http://localhost:3001',
      ),
    )

    const added = await add(join(target, 'apps/web'), 'web', 'backoffice')
    const app = join(target, 'apps/backoffice')

    expect(added).toMatchObject({ app: { name: 'backoffice', type: 'web' }, port: 5174, areas: [] })
    expect((await json(join(app, 'package.json'))).name).toBe('backoffice')
    expect((await json(join(app, 'package.json'))).dependencies['@app/api-contract']).toBe(
      'workspace:*',
    )
    expect(existsSync(join(app, 'src/api-contract'))).toBe(false)
    expect((await json(join(target, 'package.json'))).scripts.backoffice).toBe(
      'pnpm --filter backoffice dev',
    )
    expect(await read(join(app, '.env'))).toMatch(/^WEB_PORT=5174$/m)
    expect(await read(join(app, '.env'))).toMatch(/^VITE_API_URL=http:\/\/localhost:3001$/m)

    for (const file of ['.env', '.env.example']) {
      expect(await read(join(target, 'apps/api', file))).toMatch(
        /^WEB_ORIGIN=http:\/\/localhost:5173,http:\/\/localhost:5174$/m,
      )
    }

    expect((await json(join(target, '.prumo/config.json'))).apps).toEqual([
      { name: 'api', type: 'api' },
      { name: 'web', type: 'web' },
      { name: 'backoffice', type: 'web' },
    ])
  })

  it('brings the areas a new type needs, and leaves the ones the team holds as they are', async () => {
    const target = await workspace()
    const edited = join(target, '.prumo/core/naming.md')
    await writeFile(edited, '# Naming\n\nOurs now.\n')

    const added = await add(target, 'mobile')

    expect(added.areas).toEqual(['mobile'])
    expect(await read(edited)).toBe('# Naming\n\nOurs now.\n')
    expect(await read(join(target, '.prumo/INDEX.md'))).toContain('[mobile/')
    expect((await json(join(target, 'apps/mobile/app.json'))).expo.scheme).toBe('acme')
    expect(await read(join(target, 'AGENTS.md'))).toContain('# acme')
  })

  it('gives a workspace without one an api that trusts its web apps and sets its database up first', async () => {
    const target = await workspace({ types: ['web'] })

    await add(target, 'api', 'server')

    expect(await read(join(target, 'apps/server/.env'))).toMatch(
      /^WEB_ORIGIN=http:\/\/localhost:5173$/m,
    )
    expect(await read(join(target, 'apps/server/.env'))).toMatch(/^JWT_SECRET=[\w-]{43}$/m)
    expect((await json(join(target, 'package.json'))).scripts.dev).toMatch(
      /^node apps\/server\/scripts\/database\.mjs --check && /,
    )
    expect(existsSync(join(target, '.prumo/api'))).toBe(true)
  })

  it('refuses what it cannot add, before writing anything', async () => {
    const target = await workspace()
    const config = join(target, '.prumo/config.json')
    const before = await read(join(target, 'package.json'))

    await expect(add(target, 'api', 'worker')).rejects.toMatchObject({ code: 'invalid_app' })
    await expect(add(target, 'web')).rejects.toMatchObject({ code: 'invalid_app' })
    await expect(add(target, 'site', 'docs')).rejects.toMatchObject({ code: 'invalid_app' })

    await writeFile(config, (await read(config)).replace(cliVersion(), '0.6.99'))
    await expect(add(target, 'site')).rejects.toMatchObject({
      code: 'version_mismatch',
      message: expect.stringContaining('npx @stjoseph/prumo@0.6.99 add site site'),
    })

    await writeFile(config, (await read(config)).replace('0.6.99', '0.4.3'))
    await expect(add(target, 'site')).rejects.toMatchObject({
      code: 'version_mismatch',
      message: expect.stringContaining('exists from 0.6.0'),
    })

    expect(await read(join(target, 'package.json'))).toBe(before)
  })

  it('refuses an alone project', async () => {
    const target = await workspace({ types: ['web'], architecture: 'alone' })

    await expect(add(target, 'site')).rejects.toMatchObject({ code: 'not_a_workspace' })
  })

  it('puts the workspace back as it was when a step fails halfway', async () => {
    const target = await workspace()
    // A knowledge base without the site's area fails at the last step, after every other file was written.
    const broken = join(root, 'knowledge')
    await cp(knowledge, broken, { recursive: true })
    await rm(join(broken, 'site'), { recursive: true })

    const files = [
      'package.json',
      'pnpm-workspace.yaml',
      '.prumo/INDEX.md',
      '.prumo/config.json',
      'apps/api/.env',
      'apps/api/.env.example',
    ]
    const before = await Promise.all(files.map((file) => read(join(target, file))))

    await expect(add(target, 'site', 'blog', { templates, knowledge: broken })).rejects.toThrow()

    expect(await Promise.all(files.map((file) => read(join(target, file))))).toEqual(before)
    expect(existsSync(join(target, 'apps/blog'))).toBe(false)
    expect(existsSync(join(target, '.prumo/site'))).toBe(false)
  })
})
