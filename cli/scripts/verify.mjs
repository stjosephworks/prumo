import { execFileSync, spawn } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { types: { type: 'string' }, architecture: { type: 'string', default: 'alone' } },
})

const [project] = positionals
const types = (values.types ?? '').split(',').filter(Boolean)
const workspace = values.architecture === 'monorepo'
const dbPort = process.env.PRUMO_DB_PORT ?? '5432'
const appPort = 3000
const webPort = 4173
const sitePort = 3200

const appDir = (type) => (workspace ? join(project, 'apps', type) : project)
const config = JSON.parse(readFileSync(join(project, '.prumo', 'config.json'), 'utf8'))

function run(command, args, cwd, env = {}) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } })
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

async function withServer(command, args, cwd, url, env, body) {
  // In a group of its own, so stopping it stops what it started too: `pnpm preview` leaves vite running otherwise,
  // and the next run's check would be answered by the previous build.
  const server = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'inherit'],
    detached: true,
  })
  server.stdout.on('data', (chunk) => {
    process.stdout.write(chunk)
    serverLog += chunk
  })
  try {
    await waitFor(url)
    return await body()
  } finally {
    process.kill(-server.pid, 'SIGTERM')
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
  const api = appDir('api')

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
          if (workspace && types.includes('web')) await verifyContract()
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

// A session as the web holds one. With email verification on, sign-up opens none: the code the API wrote to its log
// is entered first, as a person would from their inbox.
async function webSession() {
  const API = `http://localhost:${appPort}`
  const headers = { 'content-type': 'application/json', origin: 'http://localhost:5173' }
  const email = `contract-${Date.now()}@example.com`
  let response = await fetch(`${API}/api/auth/sign-up`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Contract', email, password: 'correct-horse-battery' }),
  })

  if (response.status !== 201) throw new Error(`sign-up answered ${response.status}`)

  if ((await response.text()).includes('verificationRequired')) {
    response = await fetch(`${API}/api/auth/email/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, code: await codeMailedTo(email) }),
    })
    if (!response.ok) throw new Error(`email verification answered ${response.status}`)
  }

  return response.headers
    .getSetCookie()
    .map((header) => header.split(';')[0])
    .join('; ')
}

async function verifyContract() {
  const web = appDir('web')
  const spec = join(web, 'src', 'contract.spec.ts')
  const cookie = await webSession()

  writeFileSync(
    spec,
    `import { createClient, type Profile } from '@app/api-contract'
import { describe, expect, it } from 'vitest'

const API = 'http://localhost:${appPort}'
const ORIGIN = 'http://localhost:5173'

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
    step('workspace: the contract answers the running API', () =>
      run('pnpm', ['--filter', 'web', 'test'], project, { CONTRACT_COOKIE: cookie }),
    )
  } finally {
    // The check belongs to CI, not to the generated project: it leaves nothing behind for the next run to lint.
    rmSync(spec, { force: true })
  }
}

async function verifyWeb() {
  const web = appDir('web')

  step('web: build', () => run('pnpm', ['build'], web))
  await step('web: preview serves it', () =>
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

function verifyMobile() {
  const mobile = appDir('mobile')

  step('mobile: bundle ios and android', () =>
    run('pnpm', ['bundle'], mobile, { EXPO_PUBLIC_API_URL: `http://localhost:${appPort}` }),
  )
}

async function verifySite() {
  const site = appDir('site')
  const build = step('site: build', () => run('pnpm', ['build'], site))

  if (!/[┌└├]\s+○\s+\/(\s|$)/m.test(build)) {
    throw new Error(`the home route is not static:\n${build}`)
  }

  await step('site: start serves its metadata', () =>
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
step('test', () => run('pnpm', ['test'], project))

if (types.includes('web')) await verifyWeb()
if (types.includes('mobile')) verifyMobile()
if (types.includes('site')) await verifySite()
if (types.includes('api')) await verifyApi()

process.stdout.write(`\n${project} passed every check.\n`)
