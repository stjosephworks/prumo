import { spawn, spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const templates = resolve(import.meta.dirname, '../../templates')

const API = 39_001
const WEB = 39_002
const METRO = 39_003

function hold(port: number) {
  const server = createServer()

  return new Promise<() => Promise<void>>((done, fail) => {
    server.once('error', fail)
    server.listen(port, '127.0.0.1', () =>
      done(() => new Promise<void>((closed) => server.close(() => closed()))),
    )
  })
}

function ports(cwd: string, args: string[]) {
  const result = spawnSync(process.execPath, ['scripts/ports.mjs', ...args], {
    cwd,
    encoding: 'utf8',
  })

  return { status: result.status, out: JSON.parse(result.stdout.trim()) }
}

describe('the ports check', () => {
  let root: string
  let release: (() => Promise<void>) | undefined

  afterEach(async () => {
    await release?.()
    release = undefined
    await rm(root, { recursive: true, force: true })
  })

  async function workspace(port: number) {
    root = await mkdtemp(join(tmpdir(), 'prumo-ports-'))

    await mkdir(join(root, '.prumo'), { recursive: true })
    await writeFile(
      join(root, '.prumo/config.json'),
      JSON.stringify({ types: ['api', 'web', 'mobile'], architecture: 'monorepo' }),
    )
    await cp(join(templates, 'workspace/scripts'), join(root, 'scripts'), { recursive: true })

    for (const type of ['api', 'web', 'mobile']) {
      const app = join(root, 'apps', type)
      await mkdir(app, { recursive: true })
      await writeFile(join(app, 'package.json'), '{}')
      await cp(join(templates, type, 'scripts'), join(app, 'scripts'), { recursive: true })
      await cp(join(templates, type, '.env.example'), join(app, '.env'))
    }

    // Ports nothing on a development machine is likely to hold, so a real server never decides a test.
    await writeFile(
      join(root, 'apps/web/.env'),
      `WEB_PORT=${WEB}\nVITE_API_URL=http://localhost:${port}\n`,
    )
    await writeFile(
      join(root, 'apps/mobile/.env'),
      `METRO_PORT=${METRO}\nEXPO_PUBLIC_API_URL=http://localhost:${port}\n`,
    )

    await writeFile(
      join(root, 'apps/api/.env'),
      `PORT=${port}\nBETTER_AUTH_URL=http://localhost:${port}\nWEB_ORIGIN=http://localhost:${WEB}\n`,
    )

    return root
  }

  const env = (path: string) => readFile(join(root, path), 'utf8')

  it('says nothing when every port is free', async () => {
    await workspace(API)

    const { status, out } = ports(root, ['--all', '--json'])

    expect(status).toBe(0)
    expect(out).toEqual({
      ok: true,
      command: 'ports',
      data: { ports: { api: API, web: WEB, mobile: METRO } },
    })
  })

  it('refuses without a terminal, naming what holds the port', async () => {
    await workspace(API)
    release = await hold(API)

    const { status, out } = ports(root, ['--all', '--json'])

    expect(status).toBe(1)
    expect(out.error.code).toBe('port_busy')
    expect(out.error.message).toMatch(new RegExp(`Port ${API} is in use by .*pid \\d+`))
    expect(out.error.message).toContain('--kill')
  })

  it('moves the app to the next free port, and every URL that pointed at the old one', async () => {
    await workspace(API)
    release = await hold(API)

    const { status, out } = ports(root, ['--all', '--change', '--json'])

    expect(status).toBe(0)
    expect(out.data.ports.api).toBe(API + 1)
    expect(await env('apps/api/.env')).toMatch(new RegExp(`^PORT=${API + 1}$`, 'm'))
    expect(await env('apps/api/.env')).toMatch(
      new RegExp(`^BETTER_AUTH_URL=http://localhost:${API + 1}$`, 'm'),
    )
    expect(await env('apps/web/.env')).toMatch(
      new RegExp(`^VITE_API_URL=http://localhost:${API + 1}$`, 'm'),
    )
    expect(await env('apps/mobile/.env')).toMatch(
      new RegExp(`^EXPO_PUBLIC_API_URL=http://localhost:${API + 1}$`, 'm'),
    )
  })

  it('moves web, and the origin the API trusts with it', async () => {
    await workspace(API)
    release = await hold(WEB)

    expect(ports(root, ['--all', '--change', '--json']).out.data.ports.web).toBe(WEB + 1)
    expect(await env('apps/web/.env')).toMatch(new RegExp(`^WEB_PORT=${WEB + 1}$`, 'm'))
    expect(await env('apps/api/.env')).toMatch(
      new RegExp(`^WEB_ORIGIN=http://localhost:${WEB + 1}$`, 'm'),
    )
  })

  it('stops what holds the port when told to', async () => {
    await workspace(API)
    const child = spawn(
      process.execPath,
      [
        '-e',
        `require('node:net').createServer().listen(${API}, '127.0.0.1', () => setInterval(() => {}, 1000))`,
      ],
      { detached: true, stdio: 'ignore' },
    )

    try {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        if (ports(root, ['--all', '--json']).status === 1) {
          break
        }
        await new Promise((done) => setTimeout(done, 100))
      }

      const { status, out } = ports(root, ['--all', '--kill', '--json'])

      expect(status).toBe(0)
      expect(out.data.ports.api).toBe(API)
      expect(await env('apps/api/.env')).toMatch(new RegExp(`^PORT=${API}$`, 'm'))
    } finally {
      try {
        process.kill(-(child.pid ?? 0), 'SIGKILL')
      } catch {}
    }
  })

  it('stops the whole tree on Ctrl+C, even what escaped into its own process group', async () => {
    await workspace(API)
    const api = join(root, 'apps', 'api')

    // What `pnpm -r --parallel` does to every app: the server ends up in a process group the terminal never signals.
    await writeFile(
      join(api, 'runner.mjs'),
      [
        "import { spawn } from 'node:child_process'",
        `const server = "require('node:net').createServer().listen(${API}, '127.0.0.1', () => setInterval(() => {}, 1000))"`,
        "spawn(process.execPath, ['-e', server], { detached: true, stdio: 'ignore' }).unref()",
        'setInterval(() => {}, 1000)',
      ].join('\n'),
    )

    const supervisor = spawn(
      process.execPath,
      ['scripts/ports.mjs', '--json', '--', process.execPath, 'runner.mjs'],
      { cwd: api, detached: true, stdio: 'ignore' },
    )

    const listening = () =>
      spawnSync('lsof', ['-ti', `tcp:${API}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout.trim()

    try {
      for (let attempt = 0; attempt < 100 && listening() === ''; attempt += 1) {
        await new Promise((done) => setTimeout(done, 100))
      }

      expect(listening(), 'the fixture never took the port').not.toBe('')

      supervisor.kill('SIGINT')
      await new Promise((done) => supervisor.once('exit', done))

      expect(listening(), `something is still listening on ${API}`).toBe('')
    } finally {
      try {
        process.kill(-(supervisor.pid ?? 0), 'SIGKILL')
      } catch {}
    }
  }, 30_000)

  it('runs the command it is given, with the port appended', async () => {
    await workspace(API)
    const web = join(root, 'apps', 'web')

    await writeFile(
      join(web, 'echo.mjs'),
      'process.stderr.write(process.argv.slice(2).join(" "))\n',
    )

    const result = spawnSync(
      process.execPath,
      ['scripts/ports.mjs', '--json', '--', process.execPath, 'echo.mjs'],
      { cwd: web, encoding: 'utf8' },
    )

    expect(JSON.parse(result.stdout.trim()).data.ran).toContain(`--port ${WEB} --strictPort`)
    expect(result.stderr).toBe(`--port ${WEB} --strictPort`)
  })
})
