import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type App,
  appNameProblem,
  defaultApps,
  PORTS,
  parseApp,
  portOf,
  RESERVED_APP_NAMES,
  validateApps,
} from '../src/apps.ts'

const templates = resolve(import.meta.dirname, '../../templates')

describe('parseApp', () => {
  it('reads name=type, as --app takes it', () => {
    expect(parseApp('backoffice=web')).toEqual({ name: 'backoffice', type: 'web' })
  })

  it('refuses anything else, naming what it expected', () => {
    expect(() => parseApp('backoffice')).toThrow('<name>=<type>')
    expect(() => parseApp('a=web=site')).toThrow('<name>=<type>')
    expect(() => parseApp('admin=desktop')).toThrow('Unknown type in --app admin=desktop')
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
  it('lets web and site repeat, and nothing else', () => {
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
  it('gives the first app of a type its port, and each further one the next', async () => {
    const apps: App[] = [
      ...defaultApps(['api', 'web', 'site']),
      { name: 'backoffice', type: 'web' },
      { name: 'blog', type: 'site' },
    ]
    const ports = Object.fromEntries(apps.map((app) => [app.name, portOf(apps, app)]))

    expect(ports).toEqual({ api: 3000, web: 5173, site: 3200, backoffice: 5174, blog: 3201 })

    // The first port of a type is the one its template's .env.example declares.
    for (const [type, { key, from }] of Object.entries(PORTS)) {
      const example = await readFile(resolve(templates, type, '.env.example'), 'utf8')

      expect(example).toMatch(new RegExp(`^${key}=${from}$`, 'm'))
    }
  })
})
