import { existsSync } from 'node:fs'
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppType } from './compose.ts'
import { setJsonc } from './jsonc.ts'

// The api and web templates ship with MCP. A project that answered no receives them without it: these files are
// deleted, these dependencies removed, and every marked line or block cut. Every other type has nothing to cut.
const FILES: Partial<Record<AppType, string[]>> = {
  api: [
    'src/infra/mcp',
    'src/infra/http/controllers/mcp.controller.ts',
    'src/infra/http/controllers/mcp.controller.spec.ts',
  ],
  web: ['src/features/oauth', 'src/routes/_authenticated/consent.tsx'],
}

const DEPENDENCIES: Partial<Record<AppType, string[]>> = {
  api: [
    '@better-auth/cimd',
    '@better-auth/mcp',
    '@modelcontextprotocol/client',
    '@modelcontextprotocol/server',
  ],
  web: ['@better-auth/oauth-provider'],
}

const BLOCK_START = /^\s*\/\/ prumo:mcp$/
const BLOCK_END = /^\s*\/\/ prumo:end-mcp$/
// A marked import keeps its marker as a trailing comment, which the import sorter carries along.
const MARKED_LINE = /\s*\/\/ prumo:mcp$/

export function cutMcp(text: string, keep: boolean, file = 'a file'): string {
  const kept: string[] = []
  let inBlock = false

  for (const line of text.split('\n')) {
    if (BLOCK_START.test(line)) {
      if (inBlock) {
        throw new Error(`${file} opens a prumo:mcp block inside another`)
      }
      inBlock = true
    } else if (BLOCK_END.test(line)) {
      if (!inBlock) {
        throw new Error(`${file} closes a prumo:mcp block it never opened`)
      }
      inBlock = false
    } else if (MARKED_LINE.test(line)) {
      if (keep) {
        kept.push(line.replace(MARKED_LINE, ''))
      }
    } else if (keep || !inBlock) {
      kept.push(line)
    }
  }

  if (inBlock) {
    throw new Error(`${file} leaves a prumo:mcp block open`)
  }

  return kept.join('\n')
}

async function sourceFiles(directory: string): Promise<string[]> {
  if (!existsSync(directory)) {
    return []
  }

  const entries = await readdir(directory, { withFileTypes: true, recursive: true })

  return entries
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
}

export async function applyMcp(app: string, type: AppType, enabled: boolean): Promise<void> {
  const files = FILES[type]
  const dependencies = DEPENDENCIES[type]

  if (files === undefined || dependencies === undefined) {
    return
  }

  if (!enabled) {
    for (const file of files) {
      await rm(join(app, file), { recursive: true, force: true })
    }

    const manifest = join(app, 'package.json')
    let text = await readFile(manifest, 'utf8')

    for (const section of ['dependencies', 'devDependencies']) {
      for (const dependency of dependencies) {
        text = setJsonc(text, [section, dependency], undefined)
      }
    }

    await writeFile(manifest, text)
  }

  const sources = [
    ...(await sourceFiles(join(app, 'src'))),
    ...(await sourceFiles(join(app, 'test'))),
  ]

  for (const source of sources) {
    const text = await readFile(source, 'utf8')
    const cut = cutMcp(text, enabled, source)

    if (!enabled && dependencies.some((dependency) => cut.includes(`'${dependency}`))) {
      throw new Error(`${source} still imports an MCP package outside a prumo:mcp marker`)
    }

    if (cut !== text) {
      await writeFile(source, cut)
    }
  }
}
