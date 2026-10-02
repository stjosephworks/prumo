// Makes sure the ports the apps need are free before anything starts, and runs the dev command with the port it
// resolved. The same file ships in every app and at a workspace root; the copies are identical on purpose.
//
//   node scripts/ports.mjs --all              every app of a workspace, before its parallel run
//   node scripts/ports.mjs -- vite            this app: free its port, run the command, and stop its tree at the end
//   node scripts/ports.mjs --check            this app: free its port and stop
//
// A port in use is a question, never a silent choice: stop what holds it, or move this app to the next free port.
// Moving it rewrites the port in .env, and with it every URL that pointed at the old one.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { basename, dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'

// Where each app keeps its port, what it falls back to, and how its dev command is told about it.
const APPS = {
  api: { key: 'PORT', fallback: 3000, flag: [] },
  web: { key: 'WEB_PORT', fallback: 5173, flag: ['--port', '--strictPort'] },
  site: { key: 'SITE_PORT', fallback: 3200, flag: ['--port'] },
  mobile: { key: 'METRO_PORT', fallback: 8081, flag: ['--port'] },
}

// A port that moves takes these with it: the key to write, in which app, from which app's port.
const FOLLOWERS = {
  api: [
    { app: 'api', key: 'API_URL' },
    { app: 'web', key: 'VITE_API_URL' },
    { app: 'mobile', key: 'EXPO_PUBLIC_API_URL' },
  ],
  web: [{ app: 'api', key: 'WEB_ORIGIN' }],
  site: [],
  mobile: [],
}

const PORTS_TRIED = 20
const windows = process.platform === 'win32'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    all: { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    kill: { type: 'boolean', default: false },
    change: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
  },
})

const json = values.json
const interactive = !json && process.stdin.isTTY === true && process.stdout.isTTY === true
const here = resolve(import.meta.dirname, '..')

class Failure extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

function say(message) {
  ;(json ? process.stderr : process.stdout).write(`${message}\n`)
}

async function choose(question, answers) {
  const readline = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await readline.question(`${question} [${answers.join('/')}]: `))
    .trim()
    .toLowerCase()
  readline.close()

  return answers.find((option) => option.startsWith(answer === '' ? answers[0] : answer))
}

function envPath(directory) {
  return join(directory, '.env')
}

function readEnv(directory) {
  const path = envPath(directory)

  return existsSync(path) ? readFileSync(path, 'utf8') : undefined
}

function envValue(env, key) {
  return new RegExp(`^${key}=(.*)$`, 'm').exec(env ?? '')?.[1]?.trim()
}

function writeEnvValue(directory, key, value) {
  const env = readEnv(directory)

  if (env === undefined) {
    return
  }

  const line = new RegExp(`^${key}=.*$`, 'm')
  writeFileSync(
    envPath(directory),
    line.test(env)
      ? env.replace(line, `${key}=${value}`)
      : `${env.replace(/\n?$/, '\n')}${key}=${value}\n`,
  )
}

// The project root holds .prumo/; an app of a workspace sits two levels below it.
function projectRoot() {
  let directory = here

  while (!existsSync(join(directory, '.prumo')) && dirname(directory) !== directory) {
    directory = dirname(directory)
  }

  return existsSync(join(directory, '.prumo')) ? directory : here
}

const root = projectRoot()
const workspace = existsSync(join(root, 'apps'))

function directoryOf(type) {
  return workspace ? join(root, 'apps', type) : root
}

function typeOf(directory) {
  const name = basename(directory)

  if (APPS[name] !== undefined) {
    return name
  }

  // An alone project is named by its author, so only .prumo/config.json says what it is.
  const config = join(root, '.prumo', 'config.json')
  const types = existsSync(config) ? JSON.parse(readFileSync(config, 'utf8')).types : []

  return types[0]
}

function typesToCheck() {
  if (!values.all) {
    return [typeOf(here)]
  }

  return Object.keys(APPS).filter((type) => existsSync(join(directoryOf(type), 'package.json')))
}

function portOf(type) {
  const app = APPS[type]

  return Number(envValue(readEnv(directoryOf(type)), app.key) ?? app.fallback)
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

async function taken(port) {
  // A server may be bound to only one of the two loopback addresses.
  return (await listening('127.0.0.1', port)) || (await listening('::1', port))
}

// Who holds the port, as pid and command, so that nothing is ever killed unnamed.
function holders(port) {
  if (windows) {
    const lines = spawnSync('netstat', ['-ano'], { encoding: 'utf8' }).stdout ?? ''
    const pids = new Set(
      lines
        .split('\n')
        .filter((line) => /LISTENING/.test(line) && new RegExp(`[:.]${port}\\s`).test(line))
        .map((line) => line.trim().split(/\s+/).at(-1))
        .filter((pid) => pid !== undefined && pid !== '0'),
    )

    return [...pids].map((pid) => ({ pid: Number(pid), command: commandOf(pid) }))
  }

  const found = spawnSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
  const pids = new Set((found.stdout ?? '').split('\n').filter(Boolean))

  return [...pids].map((pid) => ({ pid: Number(pid), command: commandOf(pid) }))
}

function commandOf(pid) {
  const result = windows
    ? spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH', '/FO', 'CSV'], { encoding: 'utf8' })
    : spawnSync('ps', ['-p', String(pid), '-o', 'comm='], { encoding: 'utf8' })
  const output = (result.stdout ?? '').trim()

  return windows
    ? (output.split(',')[0]?.replaceAll('"', '') ?? 'unknown')
    : basename(output || 'unknown')
}

async function freed(port) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (!(await taken(port))) {
      return true
    }
    await new Promise((done) => setTimeout(done, 100))
  }

  return false
}

async function stopHolders(port, found) {
  for (const { pid } of found) {
    if (windows) {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
    } else {
      // The whole group, so that a shell's children go with it; a lone process when it leads no group.
      try {
        process.kill(-pid, 'SIGTERM')
      } catch {
        try {
          process.kill(pid, 'SIGTERM')
        } catch {}
      }
    }
  }

  if (await freed(port)) {
    say(`Port ${port} is free.`)
    return
  }

  for (const { pid } of found) {
    try {
      process.kill(windows ? pid : -pid, 'SIGKILL')
    } catch {}
  }

  if (!(await freed(port))) {
    throw new Failure('port_busy', `Port ${port} is still in use by ${describe(found)}.`)
  }

  say(`Port ${port} is free.`)
}

function describe(found) {
  return (
    found.map(({ pid, command }) => `${command} (pid ${pid})`).join(', ') || 'an unknown process'
  )
}

async function nextFree(from) {
  for (let port = from + 1; port < from + PORTS_TRIED; port += 1) {
    if (!(await taken(port))) {
      return port
    }
  }

  throw new Failure('port_busy', `No free port between ${from + 1} and ${from + PORTS_TRIED - 1}.`)
}

function movePort(type, port) {
  const app = APPS[type]

  writeEnvValue(directoryOf(type), app.key, port)

  for (const follower of FOLLOWERS[type]) {
    const directory = directoryOf(follower.app)

    if (existsSync(join(directory, 'package.json'))) {
      writeEnvValue(directory, follower.key, `http://localhost:${port}`)
    }
  }
}

async function settle(type) {
  const port = portOf(type)

  if (!(await taken(port))) {
    return port
  }

  const found = holders(port)

  say(`${type} wants port ${port}, held by ${describe(found)}.`)

  const moved = async () => {
    const free = await nextFree(port)
    movePort(type, free)
    say(`${type} moved to port ${free}, written to .env.`)
    return free
  }

  if (values.kill) {
    await stopHolders(port, found)
    return port
  }
  if (values.change) {
    return moved()
  }
  if (!interactive) {
    throw new Failure(
      'port_busy',
      `Port ${port} is in use by ${describe(found)}. Pass --kill to stop it, or --change to move ${type} to the next free port.`,
    )
  }

  const answer = await choose('Stop that process, or move this app?', ['stop', 'move', 'cancel'])

  if (answer === 'stop') {
    await stopHolders(port, found)
    return port
  }
  if (answer === 'move') {
    return moved()
  }

  throw new Failure('declined', 'Nothing was started.')
}

// Every process below one, as the system sees them right now.
function processTree(pid) {
  const listed = windows
    ? spawnSync(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId)" }',
        ],
        { encoding: 'utf8' },
      )
    : spawnSync('ps', ['-eo', 'pid=,ppid='], { encoding: 'utf8' })
  const children = new Map()

  for (const line of (listed.stdout ?? '').split('\n')) {
    const [child, parent] = line.trim().split(/\s+/).map(Number)

    if (Number.isInteger(child) && Number.isInteger(parent)) {
      children.set(parent, [...(children.get(parent) ?? []), child])
    }
  }

  const tree = []
  const pending = [pid]

  while (pending.length > 0) {
    const current = pending.shift()

    tree.push(current)
    pending.push(...(children.get(current) ?? []))
  }

  // Deepest first, so a parent does not restart what was just stopped.
  return tree.reverse()
}

function signal(pid, sign) {
  try {
    process.kill(pid, sign)
  } catch {}
}

// `pnpm -r --parallel` starts each app in a process group of its own, so the terminal's Ctrl+C reaches pnpm and
// nothing below it. Whatever was started here is therefore stopped from here, and never anything else: the tree is
// read before the first signal, while the processes still point at their parents.
async function shutdown(child, ports, known) {
  const tree = [...new Set([...processTree(child.pid), ...known])].reverse()
  const stopped = []

  if (windows) {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    for (const pid of tree) {
      signal(pid, 'SIGTERM')
    }
  }

  for (const port of ports) {
    if (!(await freed(port))) {
      const ours = holders(port).filter((holder) => tree.includes(holder.pid))
      const theirs = holders(port).filter((holder) => !tree.includes(holder.pid))

      for (const { pid, command } of ours) {
        signal(pid, 'SIGKILL')
        stopped.push(`${command} (pid ${pid}) on port ${port}`)
      }

      if (theirs.length > 0) {
        say(`Port ${port} is still held by ${describe(theirs)}, which this project did not start.`)
      }
    }
  }

  if (stopped.length > 0) {
    say(`Stopped what was left behind: ${stopped.join(', ')}.`)
  }

  return stopped
}

async function supervise(child, ports) {
  // Ctrl+C reaches the child through the terminal; this process only waits, and then makes sure nothing survived.
  // Once the child is gone, its own children answer to the system and no longer to it, so who they were is
  // remembered while they are still running: on a schedule, and again the moment the signal arrives.
  const known = new Set([child.pid])
  const remember = () => {
    for (const pid of processTree(child.pid)) {
      known.add(pid)
    }
  }

  let interrupted = false
  const interrupt = (sign) => {
    interrupted = true
    remember()

    // The terminal signals the whole group, but a parent that signals this process alone would leave the child
    // running and this one waiting on it forever.
    for (const pid of [...known].reverse()) {
      signal(pid, sign)
    }
  }

  const onInterrupt = () => interrupt('SIGINT')
  const onTerminate = () => interrupt('SIGTERM')

  process.on('SIGINT', onInterrupt)
  process.on('SIGTERM', onTerminate)

  remember()
  const watch = setInterval(remember, 2000)

  let patience
  const code = await new Promise((done) => {
    child.once('error', () => done(1))
    child.once('exit', (status, sign) => done(sign === null ? (status ?? 1) : 0))

    // A child that will not go after being asked does not hold this process hostage; shutdown kills it.
    patience = setInterval(() => {
      if (interrupted) {
        clearInterval(patience)
        patience = setTimeout(() => done(130), 10_000)
      }
    }, 200)
  })

  clearInterval(patience)
  clearTimeout(patience)
  clearInterval(watch)

  const stopped = await shutdown(child, ports, known)

  process.off('SIGINT', onInterrupt)
  process.off('SIGTERM', onTerminate)
  process.exitCode = interrupted ? 0 : code

  return stopped
}

async function main() {
  const ports = {}

  for (const type of typesToCheck()) {
    if (type !== undefined) {
      ports[type] = await settle(type)
    }
  }

  const [command, ...args] = positionals

  if (command === undefined) {
    return { ports }
  }

  // Only an app tells its command which port to use. A workspace root wraps `pnpm`, which would pass a stray
  // `--port` on to every app it runs.
  const [type] = values.all ? [] : Object.keys(ports)
  const flag = APPS[type ?? '']?.flag ?? []
  const withPort = flag.flatMap((entry) =>
    entry === '--port' ? ['--port', String(ports[type])] : [entry],
  )
  const child = spawn(command, [...args, ...withPort], { stdio: 'inherit', shell: windows })
  const stopped = await supervise(child, Object.values(ports))

  return { ports, ran: [command, ...args, ...withPort].join(' '), stopped }
}

try {
  const data = await main()

  if (json) {
    process.stdout.write(`${JSON.stringify({ ok: true, command: 'ports', data })}\n`)
  }
} catch (error) {
  const code = error instanceof Failure ? error.code : 'unexpected'
  const message = error instanceof Error ? error.message : String(error)

  if (json) {
    process.stdout.write(
      `${JSON.stringify({ ok: false, command: 'ports', error: { code, message } })}\n`,
    )
  } else {
    process.stderr.write(`${message}\n`)
  }
  process.exitCode = 1
}
