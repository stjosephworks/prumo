import { spawn, spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { connect, createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const templates = resolve(import.meta.dirname, '../../templates')

const API = 39_001
const WEB = 39_002
const METRO = 39_003

const windows = process.platform === 'win32'

// A process group is POSIX: there the fixture leads one, so stopping it stops what it started. Windows has no such
// group to signal, and its kill is always the whole process at once.
function stop(pid: number | undefined) {
  try {
    process.kill(windows ? (pid ?? 0) : -(pid ?? 0), 'SIGKILL')
  } catch {}
}

function alive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// Asked the way ports.mjs asks, over TCP, so the answer does not depend on lsof or netstat.
function listening(port: number) {
  return new Promise<boolean>((done) => {
    const socket = connect({ host: '127.0.0.1', port })
    const finish = (open: boolean) => {
      socket.destroy()
      done(open)
    }
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
  })
}

const SERVER = (port: number) =>
  `require('node:net').createServer().listen(${port}, '127.0.0.1', () => setInterval(() => {}, 1000))`

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
      const template = type === 'web' ? 'web-vite' : type
      await cp(join(templates, template, 'scripts'), join(app, 'scripts'), { recursive: true })
      await cp(join(templates, template, '.env.example'), join(app, '.env'))
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
      `PORT=${port}\nAPI_URL=http://localhost:${port}\nWEB_ORIGIN=http://localhost:${WEB}\n`,
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
      new RegExp(`^API_URL=http://localhost:${API + 1}$`, 'm'),
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
    const child = spawn(process.execPath, ['-e', SERVER(API)], {
      detached: !windows,
      stdio: 'ignore',
    })

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
      stop(child.pid)
    }
  })

  // Windows has no signal one process can send another as Ctrl+C: Node's SIGINT there ends the process at once, so
  // ports.mjs would never see it. The check that follows covers Windows, and CI presses a real Ctrl+C on `pnpm dev`.
  it.skipIf(windows)(
    'stops the whole tree on Ctrl+C, even what escaped into its own process group',
    async () => {
      await workspace(API)
      const api = join(root, 'apps', 'api')

      // What `pnpm -r --parallel` does to every app: the server ends up in a process group the terminal never signals.
      await writeFile(
        join(api, 'runner.mjs'),
        [
          "import { spawn } from 'node:child_process'",
          `const server = ${JSON.stringify(SERVER(API))}`,
          "spawn(process.execPath, ['-e', server], { detached: true, stdio: 'ignore' }).unref()",
          'setInterval(() => {}, 1000)',
        ].join('\n'),
      )

      const supervisor = spawn(
        process.execPath,
        ['scripts/ports.mjs', '--json', '--', process.execPath, 'runner.mjs'],
        { cwd: api, detached: true, stdio: 'ignore' },
      )

      try {
        for (let attempt = 0; attempt < 100 && !(await listening(API)); attempt += 1) {
          await new Promise((done) => setTimeout(done, 100))
        }

        expect(await listening(API), 'the fixture never took the port').toBe(true)

        supervisor.kill('SIGINT')
        await new Promise((done) => supervisor.once('exit', done))

        expect(await listening(API), `something is still listening on ${API}`).toBe(false)
      } finally {
        stop(supervisor.pid)
      }
    },
    30_000,
  )

  it('stops what the command left running when the command ends', async () => {
    await workspace(API)
    const api = join(root, 'apps', 'api')

    // The command starts a server it does not wait for, and exits. On Windows the server is a member of the job
    // however briefly the command lived, so the command lives two seconds, which is what a cold PowerShell used to
    // miss. Elsewhere the tree is read every two seconds, so the command lives long enough to be read.
    const lifetime = windows ? 2000 : 8000
    await writeFile(
      join(api, 'runner.mjs'),
      [
        "import { writeFileSync } from 'node:fs'",
        "import { spawn } from 'node:child_process'",
        `const server = ${JSON.stringify(SERVER(API))}`,
        "const child = spawn(process.execPath, ['-e', server], { detached: true, stdio: 'ignore' })",
        "writeFileSync('server.pid', String(child.pid))",
        'child.unref()',
        `setTimeout(() => {}, ${lifetime})`,
      ].join('\n'),
    )

    const supervisor = spawn(
      process.execPath,
      ['scripts/ports.mjs', '--json', '--', process.execPath, 'runner.mjs'],
      { cwd: api, stdio: 'ignore' },
    )
    const exited = new Promise((done) => supervisor.once('exit', done))
    let server: number | undefined

    try {
      for (let attempt = 0; attempt < 100 && !(await listening(API)); attempt += 1) {
        await new Promise((done) => setTimeout(done, 100))
      }

      expect(await listening(API), 'the fixture never took the port').toBe(true)
      server = Number(await readFile(join(api, 'server.pid'), 'utf8'))

      await exited

      expect(await listening(API), `something is still listening on ${API}`).toBe(false)
      expect(alive(server), `the server, pid ${server}, outlived the command`).toBe(false)
    } finally {
      stop(supervisor.pid)
      stop(server)
    }
  }, 60_000)

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

describe('the ports check with apps named on purpose', () => {
  let root: string
  let release: (() => Promise<void>) | undefined

  afterEach(async () => {
    await release?.()
    release = undefined
    await rm(root, { recursive: true, force: true })
  })

  const BACKOFFICE = 39_004

  // An api renamed server, and a second web on Next beside the first: only config.json says what each directory is.
  async function workspace() {
    root = await mkdtemp(join(tmpdir(), 'prumo-ports-named-'))

    const apps = [
      { name: 'server', type: 'api' },
      { name: 'web', type: 'web', framework: 'vite' },
      { name: 'backoffice', type: 'web', framework: 'next' },
    ]

    await mkdir(join(root, '.prumo'), { recursive: true })
    await writeFile(
      join(root, '.prumo/config.json'),
      JSON.stringify({ types: ['api', 'web'], apps, architecture: 'monorepo' }),
    )
    await cp(join(templates, 'workspace/scripts'), join(root, 'scripts'), { recursive: true })

    for (const app of apps) {
      const directory = join(root, 'apps', app.name)
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, 'package.json'), '{}')
      await cp(
        join(templates, `${app.type}${app.framework ? `-${app.framework}` : ''}`, 'scripts'),
        join(directory, 'scripts'),
        {
          recursive: true,
        },
      )
    }

    await writeFile(
      join(root, 'apps/server/.env'),
      `PORT=${API}\nAPI_URL=http://localhost:${API}\nWEB_ORIGIN=http://localhost:${WEB},http://localhost:${BACKOFFICE}\n`,
    )
    await writeFile(
      join(root, 'apps/web/.env'),
      `WEB_PORT=${WEB}\nVITE_API_URL=http://localhost:${API}\n`,
    )
    await writeFile(
      join(root, 'apps/backoffice/.env'),
      `WEB_PORT=${BACKOFFICE}\nNEXT_PUBLIC_API_URL=http://localhost:${API}\n`,
    )
  }

  const env = (path: string) => readFile(join(root, path), 'utf8')

  it('checks every app by its name, each with its own port', async () => {
    await workspace()

    const { status, out } = ports(root, ['--all', '--json'])

    expect(status).toBe(0)
    expect(out.data).toEqual({ ports: { server: API, web: WEB, backoffice: BACKOFFICE } })
    expect(ports(join(root, 'apps/backoffice'), ['--check', '--json']).out.data).toEqual({
      ports: { backoffice: BACKOFFICE },
    })
  })

  it('moves one web app and only its own entry in the list the api trusts', async () => {
    await workspace()
    release = await hold(BACKOFFICE)

    const { status, out } = ports(join(root, 'apps/backoffice'), ['--check', '--change', '--json'])
    const moved = out.data?.ports?.backoffice

    expect(status).toBe(0)
    expect(moved).toBeGreaterThan(BACKOFFICE)
    expect(await env('apps/backoffice/.env')).toContain(`WEB_PORT=${moved}`)
    expect(await env('apps/web/.env')).toContain(`WEB_PORT=${WEB}`)
    expect(await env('apps/server/.env')).toContain(
      `WEB_ORIGIN=http://localhost:${WEB},http://localhost:${moved}\n`,
    )
  })

  it('points every web app at the api when the api moves', async () => {
    await workspace()
    release = await hold(API)

    const { status, out } = ports(join(root, 'apps/server'), ['--check', '--change', '--json'])
    const moved = out.data?.ports?.server

    expect(status).toBe(0)
    expect(await env('apps/server/.env')).toContain(`API_URL=http://localhost:${moved}`)

    expect(await env('apps/web/.env')).toContain(`VITE_API_URL=http://localhost:${moved}`)
    expect(await env('apps/backoffice/.env')).toContain(
      `NEXT_PUBLIC_API_URL=http://localhost:${moved}`,
    )
  })
})
