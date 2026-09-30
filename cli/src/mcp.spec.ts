import { existsSync } from 'node:fs'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { generate } from './generate.ts'
import { cutMcp } from './mcp.ts'

const templates = resolve(import.meta.dirname, '../../templates')
const knowledge = resolve(import.meta.dirname, '../../.prumo-templates')

describe('cutMcp', () => {
  const source = [
    "import { mcp } from 'mcp' // prumo:mcp",
    "import { kept } from 'kept'",
    '// prumo:mcp',
    'mcpOnly()',
    '// prumo:end-mcp',
    'always()',
  ].join('\n')

  it('removes every marked line and block when MCP is off', () => {
    expect(cutMcp(source, false)).toBe(["import { kept } from 'kept'", 'always()'].join('\n'))
  })

  it('removes only the markers when MCP is on', () => {
    expect(cutMcp(source, true)).toBe(
      ["import { mcp } from 'mcp'", "import { kept } from 'kept'", 'mcpOnly()', 'always()'].join(
        '\n',
      ),
    )
  })

  it('refuses a block left open', () => {
    expect(() => cutMcp('// prumo:mcp\nx()', false)).toThrow('open')
  })
})

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
    expect(existsSync(join(target, 'apps/web/src/routes/_authenticated/consent.tsx'))).toBe(false)
    expect(text).not.toContain('prumo:')
    expect(text).not.toContain('@better-auth/mcp')
    expect(text).not.toContain('@better-auth/oauth-provider')
    expect(await readFile(join(target, 'pnpm-workspace.yaml'), 'utf8')).not.toContain(
      '@modelcontextprotocol',
    )
    expect(existsSync(join(target, '.prumo/mcp'))).toBe(false)
  })

  it('keeps all of it without a marker, and says so in .prumo', async () => {
    const target = await workspace(true)
    const text = await everything(target)
    const config = JSON.parse(await readFile(join(target, '.prumo/config.json'), 'utf8'))

    expect(existsSync(join(target, 'apps/api/src/infra/mcp/mcp.server.ts'))).toBe(true)
    expect(existsSync(join(target, 'apps/web/src/routes/_authenticated/consent.tsx'))).toBe(true)
    expect(text).not.toContain('prumo:')
    expect(text).toContain("from '@better-auth/mcp'")
    expect(config.mcp).toBe(true)
    expect(existsSync(join(target, '.prumo/mcp/server.md'))).toBe(true)
  })
})
