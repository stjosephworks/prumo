import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type App,
  appNameProblem,
  defaultApps,
  PORTS,
  parseApp,
  parseTypeEntry,
  portOf,
  RESERVED_APP_NAMES,
  templateOf,
  validateApps,
} from '../src/apps.ts'

const templates = resolve(import.meta.dirname, '../../templates')

describe('parseApp', () => {
  it('reads name=type, as --app takes it, with a web framework when one is named', () => {
    expect(parseApp('backoffice=web')).toEqual({ name: 'backoffice', type: 'web' })
    expect(parseApp('blog=web:next')).toEqual({ name: 'blog', type: 'web', framework: 'next' })
  })

  it('refuses anything else, naming what it expected', () => {
    expect(() => parseApp('backoffice')).toThrow('<name>=<type>')
    expect(() => parseApp('a=web=api')).toThrow('<name>=<type>')
    expect(() => parseApp('admin=desktop')).toThrow('--app admin=desktop: unknown type desktop')
    expect(() => parseApp('admin=api:next')).toThrow('only web takes a framework')
  })
})

describe('parseTypeEntry', () => {
  it('reads a framework only after web, and tells a site where it went', () => {
    expect(parseTypeEntry('web', '--types')).toEqual({ type: 'web' })
    expect(parseTypeEntry('web:vite', '--types')).toEqual({ type: 'web', framework: 'vite' })
    expect(() => parseTypeEntry('web:remix', '--types')).toThrow('web:vite, web:next')
    expect(() => parseTypeEntry('site', '--types')).toThrow('site became web:next')
  })

  it('names the template a web app comes from by its framework, Vite when it has none', () => {
    expect(templateOf({ type: 'web' })).toBe('web-vite')
    expect(templateOf({ type: 'web', framework: 'next' })).toBe('web-next')
    expect(templateOf({ type: 'api' })).toBe('api')
  })
})

describe('app names', () => {
  it('refuse a pnpm command, a root script, the project and a name taken', () => {
    const web: App = { name: 'web', type: 'web' }

    expect(appNameProblem('docs', [], 'acme')).toContain('pnpm command or a root script')
    expect(appNameProblem('test', [], 'acme')).toContain('pnpm command or a root script')
    expect(appNameProblem('acme', [], 'acme')).toContain('project’s name')
    expect(appNameProblem('web', [web], 'acme')).toContain('already named "web"')
    expect(appNameProblem('Back_office', [], 'acme')).toContain('lowercase')
    expect(appNameProblem('backoffice', [web], 'acme')).toBeUndefined()
  })

  it('reserve every script the workspace root carries, dev included', async () => {
    const root = JSON.parse(await readFile(resolve(templates, 'workspace/package.json'), 'utf8'))

    for (const script of [...Object.keys(root.scripts), 'dev']) {
      expect(RESERVED_APP_NAMES).toContain(script)
    }
  })
})

describe('validateApps', () => {
  it('lets web repeat, and nothing else', () => {
    const twoWebs = [...defaultApps(['api', 'web']), { name: 'backoffice', type: 'web' } as App]

    expect(() => validateApps(twoWebs, 'acme')).not.toThrow()
    expect(() =>
      validateApps([...defaultApps(['api']), { name: 'worker', type: 'api' }], 'acme'),
    ).toThrow('A workspace holds one api')
    expect(() =>
      validateApps([...defaultApps(['mobile']), { name: 'driver', type: 'mobile' }], 'acme'),
    ).toThrow('A workspace holds one mobile')
  })
})

describe('portOf', () => {
  it('gives the first app of a template its port, and each further one the next', async () => {
    const apps: App[] = [
      ...defaultApps(['api', 'web']),
      { name: 'backoffice', type: 'web', framework: 'vite' },
      { name: 'blog', type: 'web', framework: 'next' },
      { name: 'docs', type: 'web', framework: 'next' },
    ]
    const ports = Object.fromEntries(apps.map((app) => [app.name, portOf(apps, app)]))

    expect(ports).toEqual({ api: 3000, web: 5173, backoffice: 5174, blog: 3200, docs: 3201 })

    // The first port of a template is the one its .env.example declares.
    for (const [template, { key, from }] of Object.entries(PORTS)) {
      const example = await readFile(resolve(templates, template, '.env.example'), 'utf8')

      expect(example).toMatch(new RegExp(`^${key}=${from}$`, 'm'))
    }
  })
})
