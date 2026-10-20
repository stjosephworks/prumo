import type { Catalogs } from './compose.ts'

// pnpm-workspace.yaml as Prumo writes it: `catalog:`, `catalogs:` with a block per named catalog, and `allowBuilds:`,
// each a top-level key with its entries indented below it. An app that joins only adds to them: an entry already
// there is the workspace's, and its version wins, since a team that moved it did so on purpose.

const entryName = (line: string) => /^\s*'?([^'#\s][^':]*)'?\s*:/.exec(line)?.[1]

const indentOf = (line: string) => line.length - line.trimStart().length

// The lines of a block's entries, from the line after its key to the first line indented no deeper than it.
function block(lines: string[], key: string, indent: number, from = 0, to = lines.length) {
  const start = lines.findIndex(
    (line, index) => index >= from && index < to && line === `${' '.repeat(indent)}${key}:`,
  )

  if (start === -1) {
    return undefined
  }

  let end = start + 1

  while (end < to && (lines[end]?.trim() === '' || indentOf(lines[end] ?? '') > indent)) {
    end += 1
  }

  // Blank lines before the next key belong to the gap, not to the block.
  while (end > start + 1 && lines[end - 1]?.trim() === '') {
    end -= 1
  }

  return { start, end }
}

function addEntries(
  lines: string[],
  where: { start: number; end: number },
  entries: Record<string, string>,
  indent: number,
): void {
  const present = new Set(
    lines
      .slice(where.start + 1, where.end)
      .map(entryName)
      .filter((name) => name !== undefined),
  )
  const missing = Object.keys(entries)
    .filter((name) => !present.has(name))
    .sort()
    .map((name) => `${' '.repeat(indent)}'${name}': ${entries[name]}`)

  lines.splice(where.end, 0, ...missing)
}

export function addToCatalogs(text: string, catalogs: Catalogs): string {
  const lines = text.replace(/\n$/, '').split('\n')
  const catalog = block(lines, 'catalog', 0)

  if (catalog === undefined) {
    lines.push('', 'catalog:')
    addEntries(lines, { start: lines.length - 1, end: lines.length }, catalogs.default, 2)
  } else {
    addEntries(lines, catalog, catalogs.default, 2)
  }

  for (const [name, entries] of Object.entries(catalogs.named)) {
    let named = block(lines, 'catalogs', 0)

    if (named === undefined) {
      lines.push('', 'catalogs:')
      named = { start: lines.length - 1, end: lines.length }
    }

    const own = block(lines, name, 2, named.start + 1, named.end)

    if (own === undefined) {
      lines.splice(named.end, 0, `  ${name}:`)
      addEntries(lines, { start: named.end, end: named.end + 1 }, entries, 4)
    } else {
      addEntries(lines, own, entries, 4)
    }
  }

  return `${lines.join('\n')}\n`
}

// Each approval arrives with the comment above it that says why, as the template wrote them.
export function addApprovals(text: string, approvals: string[]): string {
  const lines = text.replace(/\n$/, '').split('\n')
  let builds = block(lines, 'allowBuilds', 0)

  if (builds === undefined) {
    if (approvals.length === 0) {
      return text
    }

    lines.push('', 'allowBuilds:')
    builds = { start: lines.length - 1, end: lines.length }
  }

  const present = new Set(
    lines
      .slice(builds.start + 1, builds.end)
      .map(entryName)
      .filter((name) => name !== undefined),
  )
  const added: string[] = []
  let comments: string[] = []

  for (const line of approvals) {
    if (line.trimStart().startsWith('#')) {
      comments.push(line)
      continue
    }

    const name = entryName(line)

    if (name !== undefined && !present.has(name)) {
      added.push(...comments, line)
      present.add(name)
    }

    comments = []
  }

  lines.splice(builds.end, 0, ...added)

  return `${lines.join('\n')}\n`
}
