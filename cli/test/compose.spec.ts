import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { composeWorkspace, copyTemplate } from '../src/compose.ts'
import { removeWhatBaseDeclares } from '../src/jsonc.ts'

const templates = resolve(import.meta.dirname, '../../templates')

describe('composeWorkspace', () => {
  let target: string

  beforeAll(async () => {
    target = join(await mkdtemp(join(tmpdir(), 'prumo-compose-')), 'workspace')
    await composeWorkspace({ templates, target, types: ['api', 'web'] })
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
    expect(scripts.site).toBeUndefined()
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
    await composeWorkspace({ templates, target, types: ['api', 'web', 'mobile'] })
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

  it('extracts one contract for both clients and turns the API’s mobile scheme on', async () => {
    const env = await readFile(join(target, 'apps/api/.env.example'), 'utf8')
    const layout = await readFile(join(target, 'apps/mobile/src/app/_layout.tsx'), 'utf8')

    expect(existsSync(join(target, 'apps/mobile/src/api-contract'))).toBe(false)
    expect(layout).toContain("from '@app/api-contract'")
    expect(env).toMatch(/^MOBILE_APP_SCHEME=app$/m)
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
      composeWorkspace({ templates: root, target: join(root, 'out'), types: ['web', 'mobile'] }),
    ).rejects.toThrow('differs from')

    await rm(root, { recursive: true, force: true })
  })
})

describe('composeWorkspace with every type', () => {
  let target: string

  beforeAll(async () => {
    target = join(await mkdtemp(join(tmpdir(), 'prumo-compose-')), 'workspace')
    await composeWorkspace({ templates, target, types: ['api', 'web', 'mobile', 'site'] })
  })

  afterAll(async () => {
    await rm(join(target, '..'), { recursive: true, force: true })
  })

  it('merges every app’s build denials and gives the site no contract it does not call', async () => {
    const workspace = await readFile(join(target, 'pnpm-workspace.yaml'), 'utf8')
    const site = await readFile(join(target, 'apps/site/package.json'), 'utf8')

    expect(workspace).toContain('ssh2: false')
    expect(workspace).toContain('sharp: false')
    expect(existsSync(join(target, 'apps/site/pnpm-workspace.yaml'))).toBe(false)
    expect(site).not.toContain('@app/api-contract')
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
    for (const type of ['api', 'web', 'mobile', 'site']) {
      const { scripts } = JSON.parse(await readFile(join(templates, type, 'package.json'), 'utf8'))

      expect(scripts.dev, `${type} has no dev script`).toBeTypeOf('string')
    }
  })

  it('checks its port before it starts, from one script every template carries', async () => {
    const copies = await Promise.all(
      ['api', 'web', 'mobile', 'site', 'workspace'].map((template) =>
        readFile(join(templates, template, 'scripts', 'ports.mjs'), 'utf8'),
      ),
    )

    expect(new Set(copies).size, 'the copies of ports.mjs have drifted apart').toBe(1)

    for (const type of ['api', 'web', 'mobile', 'site']) {
      const { scripts } = JSON.parse(await readFile(join(templates, type, 'package.json'), 'utf8'))

      expect(scripts.dev, `${type} starts without checking its port`).toContain('scripts/ports.mjs')
    }
  })

  it('names its port in .env.example, which is where the check reads it', async () => {
    const ports: Record<string, string> = {
      api: 'PORT=3000',
      web: 'WEB_PORT=5173',
      site: 'SITE_PORT=3200',
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
