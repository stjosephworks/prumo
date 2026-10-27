import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { defaultApps } from '../src/apps.ts'
import { composeWorkspace, copyTemplate } from '../src/compose.ts'
import { removeWhatBaseDeclares } from '../src/jsonc.ts'

const templates = resolve(import.meta.dirname, '../../templates')

describe('composeWorkspace', () => {
  let target: string

  beforeAll(async () => {
    target = join(await mkdtemp(join(tmpdir(), 'prumo-compose-')), 'workspace')
    await composeWorkspace({ templates, target, apps: defaultApps(['api', 'web']) })
  })

  afterAll(async () => {
    await rm(join(target, '..'), { recursive: true, force: true })
  })

  it('keeps the reason written above each rule an app changes', async () => {
    const biome = await readFile(join(target, 'apps/api/biome.jsonc'), 'utf8')

    expect(biome).toContain('"extends": "//"')
    expect(biome).toMatch(/\/\/ tsyringe injects by the emitted constructor type.*\n\s*"style"/)
    expect(biome).toMatch(/\/\/ Ports are injected with `@inject\(TOKEN\)`.*\n\s*"parser"/)
  })

  it('gives the root one command for every app and one per app it holds', async () => {
    const { scripts } = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'))

    expect(scripts.dev).toBe(
      'node apps/api/scripts/database.mjs --check && node scripts/ports.mjs --all -- pnpm -r --parallel dev',
    )
    expect(existsSync(join(target, 'scripts/ports.mjs'))).toBe(true)
    expect(existsSync(join(target, 'apps/api/scripts/database.mjs'))).toBe(true)
    expect(scripts.api).toBe('pnpm --filter api dev')
    expect(scripts.web).toBe('pnpm --filter web dev')
    expect(scripts.mobile).toBeUndefined()
  })

  it('moves the contract into a package and points every import at it', async () => {
    const form = await readFile(
      join(target, 'apps/web/src/features/profile/profile-form.tsx'),
      'utf8',
    )

    expect(existsSync(join(target, 'packages/api-contract/src/index.ts'))).toBe(true)
    expect(existsSync(join(target, 'apps/web/src/api-contract'))).toBe(false)
    expect(form).toContain("from '@app/api-contract'")
    expect(form).not.toContain("'@/api-contract'")
  })

  it('leaves no nested workspace file and no build cache behind', async () => {
    const root = await readFile(join(target, 'pnpm-workspace.yaml'), 'utf8')

    expect(existsSync(join(target, 'apps/api/pnpm-workspace.yaml'))).toBe(false)
    expect(existsSync(join(target, 'apps/api/tsconfig.tsbuildinfo'))).toBe(false)
    expect(root).toContain('ssh2: false')
  })
})

describe('removeWhatBaseDeclares', () => {
  it('removes a shared key without taking the next key’s comment with it', () => {
    const app = '{\n  "shared": 1,\n  // reason\n  "own": 2\n}'

    expect(removeWhatBaseDeclares(app, '{ "shared": 1 }')).toBe('{\n  // reason\n  "own": 2\n}')
  })
})

describe('composeWorkspace with conflicting pins', () => {
  it('refuses two versions of one dependency', async () => {
    const { collectCatalog } = await import('../src/compose.ts')

    expect(() =>
      collectCatalog([{ dependencies: { zod: '4.6.4' } }, { devDependencies: { zod: '4.6.3' } }]),
    ).toThrow('zod is pinned to both 4.6.4 and 4.6.3')
  })
})

describe('composeWorkspace with web and mobile', () => {
  let target: string

  beforeAll(async () => {
    target = join(await mkdtemp(join(tmpdir(), 'prumo-compose-')), 'workspace')
    await composeWorkspace({ templates, target, apps: defaultApps(['api', 'web', 'mobile']) })
  })

  afterAll(async () => {
    await rm(join(target, '..'), { recursive: true, force: true })
  })

  it('keeps Tailwind 3 for mobile in its named catalog and Tailwind 4 in the default one', async () => {
    const workspace = await readFile(join(target, 'pnpm-workspace.yaml'), 'utf8')
    const mobile = await readFile(join(target, 'apps/mobile/package.json'), 'utf8')
    const web = await readFile(join(target, 'apps/web/package.json'), 'utf8')

    expect(workspace).toMatch(/catalogs:\n\s+tailwind3:\n\s+'tailwindcss': 3\./)
    expect(workspace).toMatch(/\n {2}'tailwindcss': 4\./)
    expect(mobile).toContain('"tailwindcss": "catalog:tailwind3"')
    expect(web).toContain('"tailwindcss": "catalog:"')
  })

  it('extracts one contract for both clients', async () => {
    const layout = await readFile(join(target, 'apps/mobile/src/app/_layout.tsx'), 'utf8')

    expect(existsSync(join(target, 'apps/mobile/src/api-contract'))).toBe(false)
    expect(layout).toContain("from '@app/api-contract'")
  })
})

describe('composeWorkspace with clients whose contracts differ', () => {
  it('refuses to pick one of them', async () => {
    const { cp: copy, writeFile: write } = await import('node:fs/promises')
    const root = await mkdtemp(join(tmpdir(), 'prumo-templates-'))

    await copy(templates, root, {
      recursive: true,
      filter: (path) => !path.includes('node_modules'),
    })
    await write(join(root, 'mobile/src/api-contract/client.ts'), '// diverged\n', { flag: 'a' })

    await expect(
      composeWorkspace({
        templates: root,
        target: join(root, 'out'),
        apps: defaultApps(['web', 'mobile']),
      }),
    ).rejects.toThrow('differs from')

    await rm(root, { recursive: true, force: true })
  })
})

describe('composeWorkspace with every type', () => {
  let target: string

  beforeAll(async () => {
    target = join(await mkdtemp(join(tmpdir(), 'prumo-compose-')), 'workspace')
    await composeWorkspace({
      templates,
      target,
      apps: [
        ...defaultApps(['api', 'web', 'mobile']),
        { name: 'site', type: 'web', framework: 'next' },
      ],
    })
  })

  afterAll(async () => {
    await rm(join(target, '..'), { recursive: true, force: true })
  })

  it('merges every app’s build denials and shares the contract with a web app on Next', async () => {
    const workspace = await readFile(join(target, 'pnpm-workspace.yaml'), 'utf8')
    const site = JSON.parse(await readFile(join(target, 'apps/site/package.json'), 'utf8'))

    expect(workspace).toContain('ssh2: false')
    expect(workspace).toContain('sharp: false')
    expect(existsSync(join(target, 'apps/site/pnpm-workspace.yaml'))).toBe(false)
    expect(existsSync(join(target, 'apps/site/src/api-contract'))).toBe(false)
    expect(site.dependencies['@app/api-contract']).toBe('workspace:*')
  })
})

describe('composeWorkspace with apps named on purpose', () => {
  let target: string

  const read = async (path: string) => readFile(join(target, path), 'utf8')
  const manifest = async (path: string) => JSON.parse(await read(path))

  beforeAll(async () => {
    target = join(await mkdtemp(join(tmpdir(), 'prumo-compose-')), 'workspace')
    await composeWorkspace({
      templates,
      target,
      apps: [
        { name: 'server', type: 'api' },
        { name: 'web', type: 'web' },
        { name: 'backoffice', type: 'web' },
        { name: 'site', type: 'web', framework: 'next' },
        { name: 'blog', type: 'web', framework: 'next' },
      ],
    })
  })

  afterAll(async () => {
    await rm(join(target, '..'), { recursive: true, force: true })
  })

  it('puts each app under its name, with a package and a root script of that name', async () => {
    const root = await manifest('package.json')

    for (const name of ['server', 'web', 'backoffice', 'site', 'blog']) {
      expect((await manifest(`apps/${name}/package.json`)).name).toBe(name)
      expect(root.scripts[name]).toBe(`pnpm --filter ${name} dev`)
    }

    expect(existsSync(join(target, 'apps/api'))).toBe(false)
    expect(root.scripts.api).toBeUndefined()
    expect(root.scripts.dev).toBe(
      'node apps/server/scripts/database.mjs --check && node scripts/ports.mjs --all -- pnpm -r --parallel dev',
    )
  })

  it('gives each further web app of a framework the next port, and the api every web app to trust', async () => {
    expect(await read('apps/web/.env.example')).toMatch(/^WEB_PORT=5173$/m)
    expect(await read('apps/backoffice/.env.example')).toMatch(/^WEB_PORT=5174$/m)
    expect(await read('apps/site/.env.example')).toMatch(/^WEB_PORT=3200$/m)
    expect(await read('apps/blog/.env.example')).toMatch(/^WEB_PORT=3201$/m)
    expect((await manifest('apps/blog/package.json')).scripts.start).toBe('next start --port 3201')
    expect((await manifest('apps/site/package.json')).scripts.start).toBe('next start --port 3200')
    expect(await read('apps/server/.env.example')).toMatch(
      /^WEB_ORIGIN=http:\/\/localhost:5173,http:\/\/localhost:5174,http:\/\/localhost:3200,http:\/\/localhost:3201$/m,
    )
  })

  it('shares the one contract with every web app', async () => {
    for (const web of ['web', 'backoffice', 'site', 'blog']) {
      expect(existsSync(join(target, `apps/${web}/src/api-contract`))).toBe(false)
      expect((await manifest(`apps/${web}/package.json`)).dependencies['@app/api-contract']).toBe(
        'workspace:*',
      )
    }
  })
})

describe('copyTemplate from a published package', () => {
  it('restores the dot npm deletes from a template’s .gitignore', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prumo-packaged-'))
    const source = join(root, 'web')

    // This is the shape inside the tarball: npm drops `.gitignore`, so the build ships it undotted.
    await mkdir(source, { recursive: true })
    await writeFile(join(source, 'gitignore'), 'node_modules\ndist\n')

    await copyTemplate(source, join(root, 'out'))

    expect(await readFile(join(root, 'out/.gitignore'), 'utf8')).toBe('node_modules\ndist\n')
    expect(existsSync(join(root, 'out/gitignore'))).toBe(false)

    await rm(root, { recursive: true, force: true })
  })
})

describe('every template', () => {
  it('answers to dev, which is all the root scripts call', async () => {
    for (const type of ['api', 'web-vite', 'web-next', 'web-astro', 'mobile']) {
      const { scripts } = JSON.parse(await readFile(join(templates, type, 'package.json'), 'utf8'))

      expect(scripts.dev, `${type} has no dev script`).toBeTypeOf('string')
    }
  })

  it('checks its port before it starts, from one script every template carries', async () => {
    const copies = await Promise.all(
      ['api', 'web-vite', 'web-next', 'web-astro', 'mobile', 'workspace'].map((template) =>
        readFile(join(templates, template, 'scripts', 'ports.mjs'), 'utf8'),
      ),
    )

    expect(new Set(copies).size, 'the copies of ports.mjs have drifted apart').toBe(1)

    for (const type of ['api', 'web-vite', 'web-next', 'web-astro', 'mobile']) {
      const { scripts } = JSON.parse(await readFile(join(templates, type, 'package.json'), 'utf8'))

      expect(scripts.dev, `${type} starts without checking its port`).toContain('scripts/ports.mjs')
    }
  })

  it('carries one branch flow, and the rulesets that make it required', async () => {
    for (const file of [
      '.github/workflows/flow.yml',
      '.github/rulesets/flow.json',
      '.github/rulesets/project.json',
      '.githooks/pre-commit',
    ]) {
      const copies = await Promise.all(
        ['api', 'web-vite', 'web-next', 'web-astro', 'mobile', 'workspace'].map((template) =>
          readFile(join(templates, template, file), 'utf8'),
        ),
      )

      expect(new Set(copies).size, `the copies of ${file} have drifted apart`).toBe(1)
    }
  })

  it('names its port in .env.example, which is where the check reads it', async () => {
    const ports: Record<string, string> = {
      api: 'PORT=3000',
      'web-vite': 'WEB_PORT=5173',
      'web-next': 'WEB_PORT=3200',
      'web-astro': 'WEB_PORT=4321',
      mobile: 'METRO_PORT=8081',
    }

    for (const [type, line] of Object.entries(ports)) {
      const example = await readFile(join(templates, type, '.env.example'), 'utf8')

      expect(example, `${type} does not declare its port`).toContain(line)
    }
  })

  it('checks the database before the API starts', async () => {
    const { scripts } = JSON.parse(await readFile(join(templates, 'api', 'package.json'), 'utf8'))

    expect(scripts.dev).toMatch(/^node scripts\/database\.mjs --check && /)
    expect(scripts['db:setup']).toBe('node scripts/database.mjs')
  })

  it('publishes Postgres on the port .env chooses, under a name generation replaces', async () => {
    const compose = await readFile(join(templates, 'api', 'docker-compose.yml'), 'utf8')

    expect(compose).toMatch(/^name: api$/m)
    expect(compose).toMatch(/- '\$\{POSTGRES_PORT:-5432\}:5432'/)
    expect(await readFile(join(templates, 'api', '.env.example'), 'utf8')).toMatch(
      /^POSTGRES_PORT=5432$/m,
    )
  })
})
