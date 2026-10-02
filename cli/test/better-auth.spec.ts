import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const templates = resolve(import.meta.dirname, '../../templates')

// `auth` is Better Auth's CLI, released with the rest.
const FAMILY = /^(better-auth|auth|@better-auth\/.+)$/

type Manifest = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }

async function manifests(): Promise<[string, Record<string, string>][]> {
  const found: [string, Record<string, string>][] = []

  for (const template of await readdir(templates)) {
    const text = await readFile(join(templates, template, 'package.json'), 'utf8').catch(() => '')

    if (text !== '') {
      const pkg = JSON.parse(text) as Manifest
      found.push([template, { ...pkg.dependencies, ...pkg.devDependencies }])
    }
  }

  return found
}

// better-auth pins its core exactly, while every plugin only asks for a compatible one as a peer. Left to pnpm, that
// peer is the newest core on the registry, and a second core beside better-auth's breaks the typecheck.
describe('the Better Auth family', () => {
  it('is pinned to one version across every template', async () => {
    const versions = new Set<string>()

    for (const [, dependencies] of await manifests()) {
      for (const [name, version] of Object.entries(dependencies)) {
        if (FAMILY.test(name) && name !== '@better-auth/utils') {
          versions.add(version)
        }
      }
    }

    expect([...versions]).toHaveLength(1)
  })

  it('declares @better-auth/core wherever a plugin needs it as a peer', async () => {
    for (const [template, dependencies] of await manifests()) {
      const plugins = Object.keys(dependencies).filter(
        (name) => name.startsWith('@better-auth/') && name !== '@better-auth/core',
      )

      if (plugins.length > 0) {
        expect(dependencies['@better-auth/core'], template).toBe(dependencies['better-auth'])
      }
    }
  })
})
