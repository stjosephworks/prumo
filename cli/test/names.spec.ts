import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { packageExtensions } from '@yarnpkg/extensions'
import semver from 'semver'
import { afterEach, describe, expect, it } from 'vitest'
import { projectProblem, validateProjectName } from '../src/names.ts'
import { EXTENDED_BY_PNPM } from '../src/pnpm-extended.ts'

const cli = resolve(import.meta.dirname, '../src/cli.ts')
const templates = resolve(import.meta.dirname, '../../templates')

// The fields through which an extension adds a package. peerDependenciesMeta alone adds none.
const ADDING = ['dependencies', 'peerDependencies'] as const

// Every package.json the project's name can land in starts at its template's version.
async function templateVersions(): Promise<string[]> {
  const versions = await Promise.all(
    ['api', 'web-vite', 'web-next', 'mobile', 'workspace'].map(
      async (template) =>
        JSON.parse(await readFile(join(templates, template, 'package.json'), 'utf8')).version,
    ),
  )

  return [...new Set<string>(versions)]
}

describe('a project name pnpm extends', () => {
  let root: string | undefined

  afterEach(async () => {
    if (root !== undefined) {
      await rm(root, { recursive: true, force: true })
      root = undefined
    }
  })

  it('is listed exactly as the compatibility database says', async () => {
    const versions = await templateVersions()
    const expected: Record<string, string[]> = {}

    for (const [selector, extension] of packageExtensions) {
      const at = selector.lastIndexOf('@')
      const name = selector.slice(0, at)
      const range = selector.slice(at + 1)
      const added = ADDING.flatMap((field) => Object.keys(extension[field] ?? {}))

      if (
        /^[a-z][a-z0-9-]*$/.test(name) &&
        added.length > 0 &&
        versions.some((version) => semver.satisfies(version, range))
      ) {
        expected[name] = [...new Set([...(expected[name] ?? []), ...added])].sort()
      }
    }

    // When this fails, src/pnpm-extended.ts is regenerated from `expected`, sorted by name.
    expect(EXTENDED_BY_PNPM).toEqual(expected)
    expect(Object.keys(EXTENDED_BY_PNPM)).toEqual(Object.keys(expected).sort())
  })

  it('is refused with what it would install and a name to use instead', () => {
    expect(validateProjectName('ws')).toBe(
      'pnpm extends the npm package "ws" with bufferutil, utf-8-validate, and would install them ' +
        'into a project of that name. Choose another, such as "ws-app".',
    )
    expect(validateProjectName('consolidate')).toContain(
      'arc-templates, atpl, babel-core and 50 more',
    )

    for (const name of Object.keys(EXTENDED_BY_PNPM)) {
      expect(validateProjectName(`${name}-app`), name).toBeUndefined()
    }
  })

  it('leaves alone a name that is merely a package, in the tree or extended without a package', () => {
    // zod and fastify are dependencies of the api; debug's extension sets only peerDependenciesMeta.
    for (const name of ['zod', 'fastify', 'debug', 'my-app']) {
      expect(validateProjectName(name), name).toBeUndefined()
    }
  })

  it('is refused at the prompt, and with --json', async () => {
    root = await mkdtemp(join(tmpdir(), 'prumo-names-'))

    // The prompt validates with projectProblem, both for a typed name and for `.`.
    expect(projectProblem('ws', root)).toContain('Choose another, such as "ws-app".')
    expect(projectProblem('.', join(root, 'ws'))).toContain(`This directory's name, "ws"`)

    const args = ['new', 'ws', '--types', 'api,web', '--single-tenant', '--no-mcp', '--no-email']
    const plain = spawnSync(process.execPath, [cli, ...args, '--no-social'], {
      cwd: root,
      encoding: 'utf8',
    })
    const json = spawnSync(process.execPath, [cli, ...args, '--no-social', '--json'], {
      cwd: root,
      encoding: 'utf8',
    })

    expect(plain.status).toBe(1)
    expect(plain.stderr).toContain('bufferutil, utf-8-validate')
    expect(json.status).toBe(1)
    expect(JSON.parse(json.stdout)).toMatchObject({
      ok: false,
      command: 'new',
      error: {
        code: 'invalid_input',
        message: expect.stringContaining('Choose another, such as "ws-app".'),
      },
    })
  })
})
