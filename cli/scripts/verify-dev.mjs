// Starts `pnpm dev` in a generated project as a person does in a terminal, waits until every app listens, presses
// Ctrl+C, and fails unless every process the run started is gone and every port is free again.
//
//   node cli/scripts/verify-dev.mjs <project>
//
// Ctrl+C is what a person presses, so it is what this sends. On macOS and Linux that is SIGINT to the run's process
// group. Windows has no signal one process can send another as Ctrl+C, so there the run gets a console of its own and
// the event is raised in that console, which is what a terminal does when the key is pressed.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { connect } from 'node:net'
import { join, resolve } from 'node:path'

const windows = process.platform === 'win32'

// Where each app keeps its port and what it falls back to, as scripts/ports.mjs reads them.
const PORTS = {
  web: { key: 'WEB_PORT', fallback: 5173 },
  site: { key: 'SITE_PORT', fallback: 3200 },
  mobile: { key: 'METRO_PORT', fallback: 8081 },
}

const project = resolve(process.argv[2] ?? '')
const config = JSON.parse(readFileSync(join(project, '.prumo', 'config.json'), 'utf8'))

// An API's `dev` first wants a database, which this check has no Docker for.
if (config.types.includes('api')) {
  throw new Error('verify-dev.mjs runs projects without an api: an api needs its database first.')
}

const appDir = (type) =>
  config.architecture === 'monorepo' ? join(project, 'apps', type) : project

function portOf(type) {
  const env = join(appDir(type), '.env')
  const text = existsSync(env) ? readFileSync(env, 'utf8') : ''
  const value = new RegExp(`^${PORTS[type].key}=(.*)$`, 'm').exec(text)?.[1]?.trim()

  return Number(value ?? PORTS[type].fallback)
}

const ports = config.types.map(portOf)

function say(message) {
  process.stdout.write(`${message}\n`)
}

function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms))
}

function listeningOn(host, port) {
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
  return (await listeningOn('127.0.0.1', port)) || (await listeningOn('::1', port))
}

// Every process on the machine, as pid, parent and name.
function processes() {
  const listed = windows
    ? spawnSync(
        'powershell',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId) $($_.Name)" }',
        ],
        { encoding: 'utf8' },
      )
    : spawnSync('ps', ['-eo', 'pid=,ppid=,comm='], { encoding: 'utf8' })

  return (listed.stdout ?? '')
    .split('\n')
    .map((line) => /^\s*(\d+)\s+(\d+)\s+(.*?)\s*$/.exec(line))
    .filter((match) => match !== null)
    .map(([, pid, parent, name]) => ({ pid: Number(pid), parent: Number(parent), name }))
}

// The run and everything below it. Windows keeps a dead parent's id on its children, so an orphan is still found.
function tree(root) {
  const all = processes()
  const found = []
  const pending = [root]

  while (pending.length > 0) {
    const pid = pending.shift()
    const entry = all.find((process) => process.pid === pid)

    if (entry !== undefined && !found.some((known) => known.pid === pid)) {
      found.push(entry)
      pending.push(...all.filter((process) => process.parent === pid).map((child) => child.pid))
    }
  }

  return found
}

function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function start() {
  if (!windows) {
    // A process group of its own, as a shell gives the command it runs in the foreground.
    return spawn('pnpm', ['dev'], {
      cwd: project,
      stdio: ['ignore', 'inherit', 'inherit'],
      detached: true,
    })
  }

  // Detached, cmd.exe has no console, so the first program it runs is given a new one: the run's own console, as a
  // terminal window would be. The Ctrl+C raised in it reaches the run and nothing of this script or of CI.
  return spawn('pnpm dev', {
    cwd: project,
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: true,
    detached: true,
    windowsHide: true,
  })
}

// Attaches to the run's console and raises Ctrl+C there, ignoring it itself. Every process of that console receives
// it, exactly as when the key is pressed in a terminal.
const CTRL_C = `
$ErrorActionPreference = 'Stop'
Add-Type -Namespace Prumo -Name Console -MemberDefinition @'
[DllImport("kernel32.dll", SetLastError = true)] public static extern bool FreeConsole();
[DllImport("kernel32.dll", SetLastError = true)] public static extern bool AttachConsole(uint processId);
[DllImport("kernel32.dll", SetLastError = true)] public static extern bool SetConsoleCtrlHandler(IntPtr handler, bool add);
[DllImport("kernel32.dll", SetLastError = true)] public static extern bool GenerateConsoleCtrlEvent(uint ctrlEvent, uint processGroupId);
'@
[void][Prumo.Console]::FreeConsole()
if (-not [Prumo.Console]::AttachConsole([uint32]$env:PRUMO_CONSOLE_OF)) { exit 2 }
[void][Prumo.Console]::SetConsoleCtrlHandler([IntPtr]::Zero, $true)
if (-not [Prumo.Console]::GenerateConsoleCtrlEvent(0, 0)) { exit 3 }
Start-Sleep -Seconds 1
`

function pressCtrlC(run) {
  if (!windows) {
    process.kill(-run.pid, 'SIGINT')
    return
  }

  // cmd.exe holds no console; any process directly below it holds the run's.
  const inConsole = processes().find((process) => process.parent === run.pid)

  if (inConsole === undefined) {
    throw new Error('nothing runs below cmd.exe, so there is no console to press Ctrl+C in')
  }

  const pressed = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', CTRL_C], {
    env: { ...process.env, PRUMO_CONSOLE_OF: String(inConsole.pid) },
    stdio: ['ignore', 'inherit', 'inherit'],
  })

  if (pressed.status !== 0) {
    throw new Error(`raising Ctrl+C in the run's console failed with exit code ${pressed.status}`)
  }
}

function kill(pids) {
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {}
  }
}

for (const port of ports) {
  if (await taken(port)) {
    throw new Error(`port ${port} is taken before the run starts; this check needs it free`)
  }
}

say(`→ pnpm dev in ${project}, waiting for ports ${ports.join(', ')}`)

const run = start()
let exited = false
run.once('exit', () => {
  exited = true
})

let started = []

try {
  for (let second = 0; second < 180; second += 1) {
    const open = await Promise.all(ports.map(taken))

    if (open.every(Boolean)) {
      break
    }
    if (exited) {
      throw new Error('pnpm dev exited before every app was listening')
    }
    await sleep(1000)
  }

  for (const port of ports) {
    if (!(await taken(port))) {
      throw new Error(`nothing listened on port ${port} within three minutes`)
    }
  }

  // Taken while every process still points at its parent, so the list is complete.
  started = tree(run.pid)
  say(
    `→ listening; ${started.length} processes in the run: ${started.map((p) => p.name).join(', ')}`,
  )
  say('→ Ctrl+C')
  pressCtrlC(run)

  for (let second = 0; second < 60 && !exited; second += 1) {
    await sleep(1000)
  }

  if (!exited) {
    throw new Error('pnpm dev was still running a minute after Ctrl+C')
  }

  // ports.mjs waits for the ports before it exits; a little patience covers what the system has not reaped yet.
  for (let second = 0; second < 10; second += 1) {
    const left = started.filter(({ pid }) => alive(pid))
    const held = []

    for (const port of ports) {
      if (await taken(port)) {
        held.push(port)
      }
    }

    if (left.length === 0 && held.length === 0) {
      say(`→ every process stopped and ports ${ports.join(', ')} are free`)
      process.exit(0)
    }

    if (second === 9) {
      throw new Error(
        [
          'Ctrl+C left something behind:',
          ...left.map(({ pid, name }) => `  still running: ${name} (pid ${pid})`),
          ...held.map((port) => `  still held: port ${port}`),
        ].join('\n'),
      )
    }
    await sleep(1000)
  }
} catch (error) {
  // Whatever the check left running must not outlive it, or the next job on the machine meets it.
  kill([...started.map(({ pid }) => pid), ...tree(run.pid).map(({ pid }) => pid)])
  if (windows) {
    spawnSync('taskkill', ['/PID', String(run.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    try {
      process.kill(-run.pid, 'SIGKILL')
    } catch {}
  }
  throw error
}
