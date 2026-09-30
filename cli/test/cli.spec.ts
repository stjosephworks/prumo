import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const cli = resolve(import.meta.dirname, '../src/cli.ts')
const templates = resolve(import.meta.dirname, '../../templates')

function prumo(args: string[], cwd?: string) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' })

  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

function document(stdout: string) {
  const lines = stdout.trim().split('\n')

  expect(lines).toHaveLength(1)
  return JSON.parse(lines[0] as string)
}

describe('prumo', () => {
  let root: string | undefined

  afterEach(async () => {
    if (root !== undefined) {
      await rm(root, { recursive: true, force: true })
      root = undefined
    }
  })

  it('prints its version however it is asked', () => {
    const { version } = JSON.parse(
      spawnSync(process.execPath, ['-p', 'JSON.stringify(require("./package.json"))'], {
        cwd: resolve(import.meta.dirname, '..'),
        encoding: 'utf8',
      }).stdout,
    )

    for (const args of [['version'], ['--version'], ['-v']]) {
      expect(prumo(args).stdout.trim()).toBe(version)
    }
    expect(document(prumo(['version', '--json']).stdout)).toEqual({
      ok: true,
      command: 'version',
      data: { version },
    })
  })

  it('lists every command, and describes one', () => {
    const help = prumo([])

    expect(help.status).toBe(0)
    for (const command of ['new', 'db', 'clean', 'doctor', 'version', 'help']) {
      expect(help.stdout).toMatch(new RegExp(`^  ${command} `, 'm'))
    }
    expect(prumo(['new', '--help']).stdout).toBe(prumo(['help', 'new']).stdout)
    expect(prumo(['help', 'db']).stdout).toContain('--skip-migrate')

    const json = document(prumo(['help', '--json']).stdout)
    expect(json.data.commands.map((command: { name: string }) => command.name)).toEqual([
      'new',
      'db',
      'clean',
      'doctor',
      'version',
      'help',
    ])
  })

  it('answers every failure with one JSON document and a non-zero exit', () => {
    const cases: [string[], string][] = [
      [['bogus', '--json'], 'unknown_command'],
      [['new', '--bogus', '--json'], 'usage'],
      [['new', '--json'], 'needs_input'],
      [['new', 'Bad', '--types', 'api', '--json'], 'invalid_input'],
      [['clean', '--json'], 'not_a_project'],
    ]

    for (const [args, code] of cases) {
      const result = prumo(args)

      expect(result.status, args.join(' ')).toBe(1)
      expect(document(result.stdout)).toMatchObject({ ok: false, error: { code } })
    }
  })

  it('generates with --json, keeping stdout for the result alone', async () => {
    root = await mkdtemp(join(tmpdir(), 'prumo-cli-'))

    const result = prumo(
      ['new', 'acme', '--types', 'web', '--single-tenant', '--skip-install', '--json'],
      root,
    )

    expect(result.status).toBe(0)
    expect(document(result.stdout)).toMatchObject({
      ok: true,
      command: 'new',
      data: { name: 'acme', types: ['web'], architecture: 'alone', installed: false },
    })
  })

  it('refuses db outside a project and in one without an api', async () => {
    root = await mkdtemp(join(tmpdir(), 'prumo-cli-'))

    expect(document(prumo(['db', '--json'], root).stdout).error.code).toBe('not_a_project')

    await mkdir(join(root, '.prumo'))
    await writeFile(
      join(root, '.prumo/config.json'),
      JSON.stringify({ types: ['web'], architecture: 'alone', multiTenant: false }),
    )
    expect(document(prumo(['db', '--json'], root).stdout).error.code).toBe('no_api')
  })

  it("runs the API's own database script from anywhere in a workspace", async () => {
    root = await mkdtemp(join(tmpdir(), 'prumo-cli-'))
    const api = join(root, 'apps/api')

    await mkdir(join(root, '.prumo'), { recursive: true })
    await writeFile(
      join(root, '.prumo/config.json'),
      JSON.stringify({ types: ['api', 'web'], architecture: 'monorepo', multiTenant: false }),
    )
    await cp(join(templates, 'api/scripts'), join(api, 'scripts'), { recursive: true })
    await writeFile(join(api, '.env'), 'DATABASE_URL=MISSING\n')
    await mkdir(join(root, 'apps/web'), { recursive: true })

    expect(document(prumo(['db', '--json'], join(root, 'apps/web')).stdout)).toEqual({
      ok: false,
      command: 'db',
      error: {
        code: 'needs_input',
        message: 'The database name is required. Outside an interactive terminal, pass --name.',
      },
    })
  })
})

describe("the API template's database check", () => {
  let api: string

  afterEach(async () => {
    await rm(api, { recursive: true, force: true })
  })

  async function check(env: string | undefined) {
    api = await mkdtemp(join(tmpdir(), 'prumo-check-'))
    await cp(join(templates, 'api/scripts'), join(api, 'scripts'), { recursive: true })
    if (env !== undefined) {
      await writeFile(join(api, '.env'), env)
    }

    return spawnSync(process.execPath, ['scripts/database.mjs', '--check', '--json'], {
      cwd: api,
      encoding: 'utf8',
    })
  }

  it('lets the API start when the URL was chosen, or when there is no .env to judge', async () => {
    expect((await check('DATABASE_URL=postgresql://a@localhost/a\n')).status).toBe(0)
    await rm(api, { recursive: true, force: true })
    expect((await check(undefined)).status).toBe(0)
  })

  it('stops the API while the URL is MISSING and nobody can be asked', async () => {
    const result = await check('DATABASE_URL=MISSING\nAUTH_DATABASE_URL=MISSING\n')

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout).error.code).toBe('database_missing')
  })

  it('ships MISSING in the example, which is what the check looks for', async () => {
    api = await mkdtemp(join(tmpdir(), 'prumo-check-'))
    const example = await readFile(join(templates, 'api/.env.example'), 'utf8')

    expect(example).toMatch(/^DATABASE_URL=MISSING$/m)
    expect(example).toMatch(/^AUTH_DATABASE_URL=MISSING$/m)
  })
})
