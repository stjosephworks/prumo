import { execFileSync, execSync, spawn, spawnSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { types: { type: 'string' }, architecture: { type: 'string' } },
})

// Like prumo new, the layout is never assumed: a wrong one would check the wrong paths.
if (!['alone', 'monorepo'].includes(values.architecture)) {
  throw new Error('Pass --architecture alone or --architecture monorepo.')
}

const [project] = positionals
const types = (values.types ?? '').split(',').filter(Boolean)
const workspace = values.architecture === 'monorepo'
const dbPort = process.env.PRUMO_DB_PORT ?? '5432'
const appPort = 3000
const webPort = 4173

const windows = process.platform === 'win32'

const config = JSON.parse(readFileSync(join(project, '.prumo', 'config.json'), 'utf8'))
// Every app by its name; a project written before apps had names holds one per type, named after it.
const apps = config.apps ?? types.map((type) => ({ name: type, type }))
const appsOfType = (type) => apps.filter((app) => app.type === type)
// A web app is verified by its framework; one written before frameworks was Vite's.
const websOn = (framework) =>
  appsOfType('web').filter((app) => (app.framework ?? 'vite') === framework)
const appDir = (app) => (workspace ? join(project, 'apps', app.name) : project)
const envValue = (app, key) =>
  new RegExp(`^${key}=(.*)$`, 'm').exec(
    readFileSync(join(appDir(app), '.env.example'), 'utf8'),
  )?.[1]
const [apiApp] = appsOfType('api')

// On Windows pnpm is a .cmd shim, which Node starts only through a shell, and a shell given an argument list is
// deprecated (DEP0190): there the command goes as one line, each part quoted when it needs it.
function commandLine(parts) {
  return parts
    .map((part) => (/^[\w@+=:,./\\!-]+$/.test(part) ? part : `"${part.replaceAll('"', '""')}"`))
    .join(' ')
}

function run(command, args, cwd, env = {}) {
  const options = { cwd, encoding: 'utf8', env: { ...process.env, ...env } }

  return windows
    ? execSync(commandLine([command, ...args]), options)
    : execFileSync(command, args, options)
}

// The API's database and its tests run Postgres in Docker, from a Linux image. A GitHub Windows runner's Docker runs
// Windows containers only, so there they cannot run, and this says so rather than passing in silence.
function linuxContainers() {
  const engine = spawnSync('docker', ['info', '--format', '{{.OSType}}'], { encoding: 'utf8' })
  const os = engine.status === 0 ? engine.stdout.trim() : 'none'

  return { ok: os === 'linux', os }
}

const containers = apiApp !== undefined ? linuxContainers() : { ok: true }

function skip(what) {
  const here =
    containers.os === 'none'
      ? 'no Docker engine answers here'
      : `this one runs ${containers.os} containers`

  process.stdout.write(`- skipped ${what}: it needs Docker running Linux containers, and ${here}\n`)
}

function step(name, fn) {
  process.stdout.write(`→ ${name}\n`)
  return fn()
}

async function waitFor(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`${url} never answered`)
}

// What a server prints is kept as well as shown: with email on, the API's mail goes to its log, codes included.
let serverLog = ''

// The server and what it started, on Windows, by creation time as well as parent id: Windows gives the number of an
// exited process to the next one, and a parent id followed alone, as `taskkill /T` follows it, can reach winlogon or
// dwm. A child counts only when it started after its parent.
function windowsTree(root) {
  const listed = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId) $(if ($_.CreationDate) { $_.CreationDate.ToFileTimeUtc() } else { 0 })" }',
    ],
    { encoding: 'utf8', timeout: 60_000 },
  )
  const all = (listed.stdout ?? '')
    .split('\n')
    .map((line) => line.trim().split(/\s+/).map(Number))
    .filter(([pid, parent]) => Number.isInteger(pid) && Number.isInteger(parent))
  const found = []
  const pending = all.filter(([pid]) => pid === root)

  while (pending.length > 0) {
    const [pid, , created] = pending.shift()

    if (!found.includes(pid)) {
      found.push(pid)
      pending.push(
        ...all.filter(
          ([child, parent, born]) => parent === pid && child !== pid && born >= created,
        ),
      )
    }
  }

  return found
}

async function withServer(command, args, cwd, url, env, body) {
  // In a group of its own, so stopping it stops what it started too: `pnpm preview` leaves vite running otherwise,
  // and the next run's check would be answered by the previous build. Windows has no groups, so the tree is read.
  const options = { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'inherit'] }
  const server = windows
    ? spawn(commandLine([command, ...args]), { ...options, shell: true })
    : spawn(command, args, { ...options, detached: true })
  server.stdout.on('data', (chunk) => {
    process.stdout.write(chunk)
    serverLog += chunk
  })
  try {
    await waitFor(url)
    return await body()
  } finally {
    if (windows) {
      const pids = windowsTree(server.pid).flatMap((pid) => ['/PID', String(pid)])
      if (pids.length > 0) {
        spawnSync('taskkill', ['/F', ...pids], { stdio: 'ignore', timeout: 60_000 })
      }
    } else {
      process.kill(-server.pid, 'SIGTERM')
    }
  }
}

function compose(api, ...args) {
  const files = ['-f', 'docker-compose.yml']
  if (dbPort !== '5432') {
    writeFileSync(
      join(api, 'compose.port.yml'),
      `services:\n  postgres:\n    ports: !override\n      - '${dbPort}:5432'\n`,
    )
    files.push('-f', 'compose.port.yml')
  }
  return run('docker', ['compose', '-p', `prumo-verify`, ...files, ...args], api)
}

function apiEnv(api) {
  const example = readFileSync(join(api, '.env.example'), 'utf8')
  // The compose service's own database: scripts/database.mjs is what a person runs, and it asks questions.
  const url = `postgresql://app:app@localhost:${dbPort}/app`
  const env = example
    .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${url}`)
    .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${'v'.repeat(40)}`)
  writeFileSync(join(api, '.env'), env)
}

async function verifyApi() {
  const api = appDir(apiApp)

  if (!containers.ok) {
    step('api: build', () => run('pnpm', ['build'], api))
    skip('the api tests, its migrations and its start')
    return
  }

  step('api: compose up', () => compose(api, 'up', '-d', '--wait'))
  try {
    apiEnv(api)
    step('api: migrate', () => run('pnpm', ['db:migrate'], api))
    step('api: build', () => run('pnpm', ['build'], api))
    await step('api: start and answer readiness', async () =>
      withServer(
        'node',
        ['dist/infra/http/server.js'],
        api,
        `http://localhost:${appPort}/api/health/live`,
        {},
        async () => {
          const ready = await (await fetch(`http://localhost:${appPort}/api/health/ready`)).json()
          if (ready.status !== 'ok') throw new Error(`readiness is ${JSON.stringify(ready)}`)
          if (config.mcp === true) await verifyMcpDiscovery()
          if (workspace) {
            for (const web of websOn('vite')) await verifyContract(web)
          }
          if (appsOfType('web').length > 0) await verifyOrigins()
        },
      ),
    )
  } finally {
    step('api: compose down', () => compose(api, 'down', '-v'))
  }
}

// An MCP client starts from here: a 401 names this document, and it names the authorization server.
async function verifyMcpDiscovery() {
  const metadata = await (
    await fetch(`http://localhost:${appPort}/.well-known/oauth-protected-resource`)
  ).json()

  if (metadata.resource !== `http://localhost:${appPort}/api/mcp`) {
    throw new Error(`protected resource metadata is ${JSON.stringify(metadata)}`)
  }

  const refused = await fetch(`http://localhost:${appPort}/api/mcp`, { method: 'POST' })

  if (
    refused.status !== 401 ||
    !refused.headers.get('www-authenticate')?.includes('resource_metadata')
  ) {
    throw new Error(`POST /api/mcp without a token answered ${refused.status}`)
  }
}

async function codeMailedTo(email) {
  const pattern = new RegExp(
    `\\[mail\\] to ${email.replace(/[.+]/g, '\\$&')}:[^\\n]*\\n[^\\n]*?(\\d{6})`,
  )

  for (let i = 0; i < 50; i += 1) {
    const code = pattern.exec(serverLog)?.[1]
    if (code !== undefined) return code
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`no code was mailed to ${email}`)
}

// The API allows ten password attempts a minute, and a workspace with many web apps opens more sessions than that. A
// refused attempt is retried once the API says it may be, as a client that respects the limit would.
async function attempt(url, init) {
  for (let tries = 0; ; tries += 1) {
    const response = await fetch(url, init)

    if (response.status !== 429 || tries === 3) return response

    const seconds = Number(response.headers.get('retry-after') ?? 60)
    await new Promise((resolve) => setTimeout(resolve, (seconds + 1) * 1000))
  }
}

// How the project signs in; a config written before 0.9.0 says nothing, and signed in with a password.
const signIn = config.signIn ?? ['password']

// A session as the web holds one, through the project's own way in: by a code when it has one, which is what a
// person who has never signed up meets; else by signing up with a password. With email verification on, that
// sign-up opens none: the code the API wrote to its log is entered first, as a person would from their inbox.
async function webSession(origin = 'http://localhost:5173') {
  const API = `http://localhost:${appPort}`
  const headers = { 'content-type': 'application/json', origin }
  const email = `contract-${Date.now()}@example.com`
  let response

  if (signIn.includes('email-code')) {
    const sent = await attempt(`${API}/api/auth/email/code`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email }),
    })
    if (sent.status !== 204) throw new Error(`asking for a sign-in code answered ${sent.status}`)

    response = await attempt(`${API}/api/auth/email/sign-in`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, code: await codeMailedTo(email) }),
    })
    if (!response.ok) throw new Error(`signing in with the code answered ${response.status}`)
  } else {
    response = await attempt(`${API}/api/auth/sign-up`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Contract', email, password: 'correct-horse-battery' }),
    })

    if (response.status !== 201) throw new Error(`sign-up answered ${response.status}`)

    if ((await response.text()).includes('verificationRequired')) {
      response = await attempt(`${API}/api/auth/email/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, code: await codeMailedTo(email) }),
      })
      if (!response.ok) throw new Error(`email verification answered ${response.status}`)
    }
  }

  return response.headers
    .getSetCookie()
    .map((header) => header.split(';')[0])
    .join('; ')
}

const originOf = (web) => `http://localhost:${envValue(web, 'WEB_PORT')}`

// Every web app leans on its cookie from its own origin, and the API trusts each of them; nothing else.
async function verifyOrigins() {
  await step('api: trusts every web app, and no other origin', async () => {
    for (const origin of [...appsOfType('web').map(originOf), 'https://elsewhere.invalid']) {
      const trusted = origin !== 'https://elsewhere.invalid'
      const cookie = await webSession(trusted ? origin : undefined)
      const response = await fetch(`http://localhost:${appPort}/api/auth/sign-out`, {
        method: 'POST',
        headers: { cookie, origin },
      })

      if (response.status !== (trusted ? 204 : 403)) {
        throw new Error(`sign-out from ${origin} answered ${response.status}`)
      }
    }
  })
}

async function verifyContract(app) {
  const web = appDir(app)
  const spec = join(web, 'src', 'contract.spec.ts')
  const cookie = await webSession(originOf(app))

  writeFileSync(
    spec,
    `import { createClient, type Profile } from '@app/api-contract'
import { describe, expect, it } from 'vitest'

const API = 'http://localhost:${appPort}'
const ORIGIN = '${originOf(app)}'

describe('the hand-written contract against the running API', () => {
  it('describes what /users/me actually returns', async () => {
    const cookie = process.env.CONTRACT_COOKIE ?? ''
    const api = createClient({
      baseUrl: API,
      fetch: (input, init) =>
        fetch(input, { ...init, headers: { ...init?.headers, cookie, origin: ORIGIN } }),
    })

    const profile: Profile = await api.get<Profile>('/users/me')
    const expected: Array<keyof Profile> = [
      'id',
      'userId',
      'displayName',
      'locale',
      'timezone',
      'createdAt',
      'updatedAt',
    ]

    expect(Object.keys(profile).sort()).toEqual([...expected].sort())
  })
})
`,
  )

  try {
    step(`${app.name}: the contract answers the running API`, () =>
      run('pnpm', ['--filter', app.name, 'test'], project, { CONTRACT_COOKIE: cookie }),
    )
  } finally {
    // The check belongs to CI, not to the generated project: it leaves nothing behind for the next run to lint.
    rmSync(spec, { force: true })
  }
}

async function verifyWeb(app) {
  const web = appDir(app)

  step(`${app.name}: build`, () => run('pnpm', ['build'], web))
  await step(`${app.name}: preview serves it`, () =>
    withServer(
      'pnpm',
      ['preview', '--port', String(webPort), '--strictPort'],
      web,
      `http://localhost:${webPort}/`,
      {},
      async () => {
        const html = await (await fetch(`http://localhost:${webPort}/`)).text()
        if (!html.includes('<div id="root">'))
          throw new Error('the served page has no root element')
      },
    ),
  )
}

// Every page is built ahead of time; the public one carries its metadata, and the HTML ships no React of its own.
async function verifyAstro(app) {
  const web = appDir(app)

  step(`${app.name}: build`, () => run('pnpm', ['build'], web))
  await step(`${app.name}: preview serves its metadata`, () =>
    withServer(
      'pnpm',
      ['preview', '--port', String(webPort)],
      web,
      `http://localhost:${webPort}/`,
      {},
      async () => {
        const html = await (await fetch(`http://localhost:${webPort}/`)).text()
        if (!/<title>/.test(html) || !/<meta name="description"/.test(html)) {
          throw new Error('the served HTML carries no title or description')
        }
        if (/<astro-island/.test(html)) throw new Error('the public home page hydrates an island')
      },
    ),
  )
}

function verifyMobile(app) {
  const mobile = appDir(app)

  step(`${app.name}: bundle ios and android`, () =>
    run('pnpm', ['bundle'], mobile, { EXPO_PUBLIC_API_URL: `http://localhost:${appPort}` }),
  )
}

async function verifyNext(app) {
  const site = appDir(app)
  // Each app on Next starts on the port its own start script names.
  const sitePort = /--port (\d+)/.exec(
    JSON.parse(readFileSync(join(site, 'package.json'), 'utf8')).scripts.start,
  )?.[1]
  const build = step(`${app.name}: build`, () => run('pnpm', ['build'], site))

  if (!/[┌└├]\s+○\s+\/(\s|$)/m.test(build)) {
    throw new Error(`the home route is not static:\n${build}`)
  }

  await step(`${app.name}: start serves its metadata`, () =>
    withServer('pnpm', ['start'], site, `http://localhost:${sitePort}/`, {}, async () => {
      const html = await (await fetch(`http://localhost:${sitePort}/`)).text()
      if (!/<title>/.test(html) || !/<meta name="description"/.test(html)) {
        throw new Error('the served HTML carries no title or description')
      }
    }),
  )
}

step('lint', () => run('pnpm', ['lint'], project))
step('typecheck', () => run('pnpm', ['typecheck'], project))
if (containers.ok) {
  step('test', () => run('pnpm', ['test'], project))
} else if (workspace && apps.length > 1) {
  step('test, except the api', () =>
    run('pnpm', ['-r', '--filter', `!${apiApp?.name ?? 'api'}`, 'test'], project),
  )
}

for (const app of websOn('vite')) await verifyWeb(app)
for (const app of websOn('next')) await verifyNext(app)
for (const app of websOn('astro')) await verifyAstro(app)
for (const app of appsOfType('mobile')) verifyMobile(app)
if (apiApp !== undefined) await verifyApi()

// The pre-commit hook is a shell script, which Git for Windows runs through the sh it ships.
step('commit, through the pre-commit hook', () => {
  const identity = ['-c', 'user.name=Prumo CI', '-c', 'user.email=ci@prumo.invalid']

  run('git', ['add', '--all'], project)
  run('git', [...identity, 'commit', '--quiet', '--message', 'Generated'], project)
})

process.stdout.write(
  `\n${project} passed every check${containers.ok ? '' : ', but for what is skipped above'}.\n`,
)
