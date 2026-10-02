// Creates the development database in Docker and writes its URL into .env.
//
//   node scripts/database.mjs            creates a database, whatever .env holds
//   node scripts/database.mjs --check    does nothing unless DATABASE_URL is still MISSING; `pnpm dev` runs this
//
// The server is always the one in docker-compose.yml, published on 5432 or, when that port is taken, the next free
// one, kept in POSTGRES_PORT. It needs no dependency, so it runs before `pnpm install` has installed anything.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { basename, dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'

const MISSING = 'MISSING'
const USER = 'app'
const PASSWORD = 'app'
const DEFAULT_PORT = 5432
const PORTS_TRIED = 20
const NAME = /^[a-z_][a-z0-9_]{0,62}$/

const api = resolve(import.meta.dirname, '..')
const envPath = join(api, '.env')

const { values } = parseArgs({
  options: {
    check: { type: 'boolean', default: false },
    name: { type: 'string' },
    port: { type: 'string' },
    'skip-migrate': { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
  },
})

const json = values.json
const interactive = !json && process.stdin.isTTY === true && process.stdout.isTTY === true
// Under --json, stdout belongs to the result document.
const childStdio = ['ignore', json ? 2 : 'inherit', 'inherit']

class Failure extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

function say(message) {
  ;(json ? process.stderr : process.stdout).write(`${message}\n`)
}

async function ask(question, fallback) {
  const readline = createInterface({ input: process.stdin, output: process.stdout })
  const suffix = fallback === undefined ? '' : ` (${fallback})`
  const answer = (await readline.question(`${question}${suffix}: `)).trim()
  readline.close()
  return answer === '' ? fallback : answer
}

async function confirm(question) {
  const answer = await ask(`${question} [Y/n]`)
  return answer === undefined || /^y(es)?$/i.test(answer)
}

function readEnv() {
  return existsSync(envPath) ? readFileSync(envPath, 'utf8') : undefined
}

function envValue(env, key) {
  return new RegExp(`^${key}=(.*)$`, 'm').exec(env)?.[1]?.trim()
}

function withEnvValue(env, key, value) {
  const line = new RegExp(`^${key}=.*$`, 'm')
  return line.test(env)
    ? env.replace(line, `${key}=${value}`)
    : `${env.replace(/\n?$/, '\n')}${key}=${value}\n`
}

function writeEnv(entries) {
  let env = readEnv() ?? ''
  for (const [key, value] of Object.entries(entries)) {
    env = withEnvValue(env, key, value)
  }
  writeFileSync(envPath, env)
}

function defaultName() {
  let directory = api

  // The project root is where .prumo/ lives: the api itself when alone, two levels up in a workspace.
  while (!existsSync(join(directory, '.prumo')) && dirname(directory) !== directory) {
    directory = dirname(directory)
  }

  const root = existsSync(join(directory, '.prumo')) ? directory : api
  const name = basename(root)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')

  return NAME.test(name) ? name : `app_${name}`.slice(0, 63)
}

function docker(args, options = {}) {
  return spawnSync('docker', args, { cwd: api, encoding: 'utf8', ...options })
}

function listening(host, port) {
  return new Promise((done) => {
    const socket = connect({ host, port, timeout: 1000 })
    const finish = (open) => {
      socket.destroy()
      done(open)
    }
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

async function portTaken(port) {
  // A server on this machine may listen on only one of the two loopback addresses.
  return (await listening('127.0.0.1', port)) || (await listening('::1', port))
}

function requireDocker() {
  if (docker(['--version']).error !== undefined) {
    throw new Failure(
      'docker_missing',
      'Docker is not installed. Install Docker Desktop from https://www.docker.com/products/docker-desktop/ and run this again.',
    )
  }
  if (docker(['info']).status !== 0) {
    throw new Failure(
      'docker_not_running',
      'Docker is installed but not running. Open Docker Desktop, wait until it says it is running, and run this again.',
    )
  }
}

// The port the service already publishes, when it is up: moving it would only restart it for nothing.
function publishedPort() {
  const result = docker(['compose', 'port', 'postgres', '5432'])
  const port = /:(\d+)\s*$/.exec(result.stdout ?? '')?.[1]

  return result.status === 0 && port !== undefined ? Number(port) : undefined
}

async function choosePort(env) {
  const running = publishedPort()

  if (running !== undefined) {
    return running
  }

  if (values.port !== undefined) {
    const port = Number(values.port)
    if (await portTaken(port)) {
      throw new Failure('port_busy', `Port ${port} is already in use.`)
    }
    return port
  }

  const start = Number(envValue(env, 'POSTGRES_PORT') ?? DEFAULT_PORT)

  for (let port = start; port < start + PORTS_TRIED; port += 1) {
    if (!(await portTaken(port))) {
      if (port !== start) {
        say(`Port ${start} is in use; Postgres will listen on ${port}.`)
      }
      return port
    }
  }

  throw new Failure(
    'port_busy',
    `Ports ${start} to ${start + PORTS_TRIED - 1} are all in use. Pass --port with a free one.`,
  )
}

function startPostgres(port) {
  // docker-compose.yml reads POSTGRES_PORT from this .env, so the file is written before the service starts.
  writeEnv({ POSTGRES_PORT: port })
  say('Starting Postgres in Docker…')

  if (docker(['compose', 'up', '-d', '--wait'], { stdio: childStdio }).status !== 0) {
    throw new Failure('docker_failed', '`docker compose up -d --wait` failed; its output is above.')
  }
}

// Stop at the first error, print bare values, and read the SQL from stdin.
const PSQL_SCRIPT = ['-v', 'ON_ERROR_STOP=1', '-tAq', '-f', '-']

function sql(database, text) {
  const result = docker(
    ['compose', 'exec', '-T', 'postgres', 'psql', '-U', USER, '-d', database, ...PSQL_SCRIPT],
    { input: text },
  )

  if (result.error !== undefined || result.status !== 0) {
    throw new Failure(
      'postgres_error',
      result.stderr?.trim() || result.error?.message || 'psql failed',
    )
  }

  return result.stdout.trim()
}

async function main() {
  const env = readEnv()

  if (values.check) {
    // No .env, or a URL someone already chose: the API's own validation has the last word.
    if (env === undefined || envValue(env, 'DATABASE_URL') !== MISSING) {
      return undefined
    }
    if (!interactive) {
      throw new Failure(
        'database_missing',
        'DATABASE_URL is MISSING in .env. Run `pnpm db:setup` first.',
      )
    }
    say('DATABASE_URL in .env is still MISSING.')
    if (!(await confirm('Create a development database in Docker now?'))) {
      throw new Failure('declined', 'DATABASE_URL is MISSING. Run `pnpm db:setup` when ready.')
    }
  }

  if (env === undefined) {
    throw new Failure('env_missing', `${envPath} does not exist. Copy .env.example to .env first.`)
  }

  const name = values.name ?? (interactive ? await ask('Database name', defaultName()) : undefined)

  if (name === undefined) {
    throw new Failure(
      'needs_input',
      'The database name is required. Outside an interactive terminal, pass --name.',
    )
  }
  if (!NAME.test(name)) {
    throw new Failure(
      'invalid_name',
      `"${name}" is not a valid name: lowercase letters, digits and _, not starting with a digit.`,
    )
  }

  requireDocker()

  const port = await choosePort(env)
  startPostgres(port)

  const exists = sql('postgres', `SELECT 1 FROM pg_database WHERE datname = '${name}'`) === '1'

  if (exists) {
    say(`Database ${name} already exists; using it.`)
  } else {
    sql('postgres', `CREATE DATABASE "${name}"`)
    say(`Created database ${name}.`)
  }

  const url = `postgresql://${USER}:${PASSWORD}@localhost:${port}/${name}`
  writeEnv({ DATABASE_URL: url })
  say('Wrote DATABASE_URL to .env.')

  let migrated = false

  if (!values['skip-migrate']) {
    say('Migrating…')
    if (spawnSync('pnpm', ['db:migrate'], { cwd: api, stdio: childStdio }).status !== 0) {
      throw new Failure(
        'migrate_failed',
        '`pnpm db:migrate` failed. The database exists and .env points at it.',
      )
    }
    migrated = true
  }

  return { database: name, port, created: !exists, migrated }
}

try {
  const data = await main()
  if (json) {
    process.stdout.write(`${JSON.stringify({ ok: true, command: 'db', data: data ?? null })}\n`)
  }
} catch (error) {
  const code = error instanceof Failure ? error.code : 'unexpected'
  const message = error instanceof Error ? error.message : String(error)

  if (json) {
    process.stdout.write(
      `${JSON.stringify({ ok: false, command: 'db', error: { code, message } })}\n`,
    )
  } else {
    process.stderr.write(`${message}\n`)
  }
  process.exitCode = 1
}
