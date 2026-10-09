import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { nextSteps } from '../src/next-steps.ts'

const templates = resolve(import.meta.dirname, '../../templates')
const cwd = '/work'

describe('nextSteps', () => {
  it('enters the project, and says the API offers to create its database', () => {
    expect(
      nextSteps({
        target: '/work/acme',
        cwd,
        types: ['api', 'web'],
        architecture: 'monorepo',
        installed: true,
      }),
    ).toEqual(['cd acme', 'pnpm dev  # offers to create the database first'])
  })

  it('stays put for `prumo new .`, and installs first after --skip-install', () => {
    expect(
      nextSteps({ target: cwd, cwd, types: ['web'], architecture: 'alone', installed: false }),
    ).toEqual(['pnpm install', 'pnpm dev'])
  })

  it('builds the mobile app first, by the script its layout reaches', () => {
    const alone = nextSteps({
      target: '/work/acme',
      cwd,
      types: ['mobile'],
      architecture: 'alone',
      installed: true,
    })
    const workspace = nextSteps({
      target: '/work/acme',
      cwd,
      types: ['api', 'mobile'],
      architecture: 'monorepo',
      installed: true,
    })

    expect(alone[1]).toMatch(/^pnpm ios {2}# or android/)
    expect(workspace[1]).toMatch(/^pnpm --filter mobile ios {2}# or android/)
    expect(workspace[2]).toMatch(/^pnpm dev +# offers to create the database first$/)
  })

  it('quotes a directory with a space in it', () => {
    expect(
      nextSteps({
        target: '/work/my app',
        cwd,
        types: ['site'],
        architecture: 'alone',
        installed: true,
      })[0],
    ).toBe('cd "my app"')
  })

  // A step names only scripts the templates ship; the workspace root gets `dev` and one script per app from compose.
  it('names only scripts the templates have', async () => {
    const scripts = async (type: string) =>
      Object.keys(JSON.parse(await readFile(join(templates, type, 'package.json'), 'utf8')).scripts)

    for (const type of ['api', 'web', 'mobile', 'site']) {
      expect(await scripts(type), type).toContain('dev')
    }
    expect(await scripts('mobile')).toEqual(expect.arrayContaining(['ios', 'android']))
  })
})
