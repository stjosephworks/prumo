// Starts `pnpm dev` in a generated project as a person does in a terminal, waits until every app listens, presses
// Ctrl+C, and fails unless every process the run started is gone and every port is free again.
//
//   node cli/scripts/verify-dev.mjs <project>
//
// Ctrl+C is what a person presses, so it is what this sends. On macOS and Linux that is SIGINT to the run's process
// group. Windows has no signal one process can send another as Ctrl+C, so there the run gets a console of its own and
// the event is raised in that console, which is what a terminal does when the key is pressed. For that, the check
// runs again detached, with no console at all: the shell it then starts is given a new console, which is the run's
// alone, while its output still comes back here. That shell is PowerShell, from which a person would type the command.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { connect } from 'node:net'
import { basename, join, resolve } from 'node:path'

const windows = process.platform === 'win32'

// Where each app keeps its port and what it falls back to, as scripts/ports.mjs reads them, by the template it came
// from: a web app's is its framework's.
const PORTS = {
  'web-vite': { key: 'WEB_PORT', fallback: 5173 },
  'web-next': { key: 'WEB_PORT', fallback: 3200 },
  'web-astro': { key: 'WEB_PORT', fallback: 4321 },
  mobile: { key: 'METRO_PORT', fallback: 8081 },
}

const templateOf = (app) => (app.type === 'web' ? `web-${app.framework ?? 'vite'}` : app.type)

const project = resolve(process.argv[2] ?? '')

// Every wait below has its own deadline, and this one covers the whole check: a hang fails it, loudly, in minutes.
const DEADLINE = 8 * 60_000

// Output is relayed through a pipe, never handed down: a process that survives the run must not hold the CI step's
// own output open, or the step waits on it until the job times out instead of failing.
function relay(child) {
  child.stdout?.pipe(process.stdout, { end: false })
  child.stderr?.pipe(process.stderr, { end: false })
}

if (windows && process.argv[3] !== '--host') {
  const host = spawn(process.execPath, [import.meta.filename, project, '--host'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  relay(host)

  const watchdog = setTimeout(() => {
    process.stderr.write(`verify-dev.mjs ran past ${DEADLINE / 60_000} minutes; stopping it.\n`)
    kill(tree(host.pid).map(({ pid }) => pid))
    spawnSync('taskkill', ['/PID', String(host.pid), '/F'], {
      stdio: 'ignore',
      timeout: 60_000,
    })
    process.exit(1)
  }, DEADLINE + 60_000)

  const code = await new Promise((done) => host.once('exit', (status) => done(status ?? 1)))
  clearTimeout(watchdog)
  process.exit(code)
}

const config = JSON.parse(readFileSync(join(project, '.prumo', 'config.json'), 'utf8'))

// An API's `dev` first wants a database, which this check has no Docker for.
if (config.types.includes('api')) {
  throw new Error('verify-dev.mjs runs projects without an api: an api needs its database first.')
}

// Every app by its name; a project written before apps had names holds one per type, named after it.
const apps = config.apps ?? config.types.map((type) => ({ name: type, type }))

const appDir = (app) =>
  config.architecture === 'monorepo' ? join(project, 'apps', app.name) : project

function portOf(app) {
  const env = join(appDir(app), '.env')
  const text = existsSync(env) ? readFileSync(env, 'utf8') : ''
  const value = new RegExp(`^${PORTS[templateOf(app)].key}=(.*)$`, 'm').exec(text)?.[1]?.trim()

  return Number(value ?? PORTS[templateOf(app)].fallback)
}

const ports = apps.map(portOf)

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

// Every process on the machine, as pid, parent, name and command line.
function processes() {
  const listed = windows
    ? spawnSync(
        'powershell',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId) $(if ($_.CreationDate) { $_.CreationDate.ToFileTimeUtc() } else { 0 }) $($_.Name) $($_.CommandLine)" }',
        ],
        { encoding: 'utf8', timeout: 60_000 },
      )
    : spawnSync('ps', ['-eo', 'pid=,ppid=,command='], { encoding: 'utf8', timeout: 60_000 })

  // ps has no creation time to give here, and needs none: there an orphan moves to init.
  return (listed.stdout ?? '')
    .split('\n')
    .map((line) =>
      windows
        ? /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s*(.*?)\s*$/.exec(line)
        : /^\s*(\d+)\s+(\d+)\s+()(\S+)\s*(.*?)\s*$/.exec(line),
    )
    .filter((match) => match !== null)
    .map(([, pid, parent, created, name, command]) => ({
      pid: Number(pid),
      parent: Number(parent),
      created: Number(created || 0),
      // ps puts the whole command in one column, which starts with the program.
      name: windows ? name : basename(name),
      command: windows ? command : `${name} ${command}`,
    }))
}

// What runs from inside the project, whoever its parent is: an orphan that no tree reaches any more still names a
// file of the project on its command line. This script names the project too, and is left out.
function fromProject() {
  const normalize = (text) => (windows ? text.replaceAll('\\', '/').toLowerCase() : text)
  const inside = normalize(project)

  return processes().filter(
    ({ pid, command }) =>
      pid !== process.pid &&
      pid !== process.ppid &&
      normalize(command).includes(inside) &&
      !command.includes('verify-dev.mjs'),
  )
}

// The run and everything below it. Windows keeps a dead parent's id on its children, so an orphan is still found.
//
// A process that started before its parent's number was given out is not that process's child: the number was reused.
// Windows hands out the numbers of exited processes again, and winlogon, dwm and csrss name as parent an smss that
// exited at boot, so without this rule the run adopts them, and stopping them ends the runner's session.
function tree(root) {
  const all = processes()
  const found = []
  const pending = [root]

  while (pending.length > 0) {
    const pid = pending.shift()
    const entry = all.find((process) => process.pid === pid)

    if (entry !== undefined && !found.some((known) => known.pid === pid)) {
      found.push(entry)
      pending.push(
        ...all
          .filter((process) => process.parent === pid && process.pid !== pid)
          .filter((process) => !windows || process.created >= entry.created)
          .map((child) => child.pid),
      )
    }
  }

  return found
}

// The console functions of kernel32, for PowerShell to call.
const CONSOLE_API = `$ErrorActionPreference = 'Stop'
Add-Type -Namespace Prumo -Name Console -MemberDefinition @'
[DllImport("kernel32.dll", SetLastError = true)] public static extern bool FreeConsole();
[DllImport("kernel32.dll", SetLastError = true)] public static extern bool AttachConsole(uint processId);
[DllImport("kernel32.dll", SetLastError = true)] public static extern bool SetConsoleCtrlHandler(IntPtr handler, bool add);
[DllImport("kernel32.dll", SetLastError = true)] public static extern bool GenerateConsoleCtrlEvent(uint ctrlEvent, uint processGroupId);
'@`

function start() {
  if (!windows) {
    // A process group of its own, as a shell gives the command it runs in the foreground.
    return spawn('pnpm', ['dev'], {
      cwd: project,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    })
  }

  // This process has no console, so PowerShell is given a new one: the run's own, as a terminal window would be, and
  // the Ctrl+C raised in it reaches the run and nothing of this script or of CI. Detaching also turned Ctrl+C off for
  // every process below this one, which a terminal never does, so PowerShell turns it back on before it runs pnpm.
  const launch = `${CONSOLE_API}
[void][Prumo.Console]::SetConsoleCtrlHandler([IntPtr]::Zero, $false)
pnpm dev
exit $LASTEXITCODE
`

  return spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', launch], {
    cwd: project,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

// Attaches to the run's console and raises Ctrl+C there, ignoring it itself. Every process of that console receives
// it, exactly as when the key is pressed in a terminal.
const CTRL_C = `${CONSOLE_API}
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

  const pressed = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', CTRL_C], {
    env: { ...process.env, PRUMO_CONSOLE_OF: String(run.pid) },
    stdio: ['ignore', 'inherit', 'inherit'],
    timeout: 60_000,
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
let started = []

relay(run)
run.once('exit', () => {
  exited = true
})

async function held() {
  const busy = []

  for (const port of ports) {
    if (await taken(port)) {
      busy.push(port)
    }
  }

  return busy
}

// Says what is left, stops all of it, and fails. Nothing the run started outlives the check.
async function fail(reason) {
  // What was seen at the start counts only while the same process still holds its number.
  const now = processes()
  const still = started.filter(({ pid, created }) =>
    now.some((process) => process.pid === pid && process.created === created),
  )
  const left = [...still, ...tree(run.pid), ...fromProject()].filter(
    (entry, index, all) => all.findIndex(({ pid }) => pid === entry.pid) === index,
  )
  const pids = left.map(({ pid }) => pid)

  say(`✗ ${reason}`)
  for (const { pid, name, command } of left) {
    say(`  still running: ${name} (pid ${pid}) ${command}`)
  }
  for (const port of await held()) {
    say(`  still held: port ${port}`)
  }

  kill(pids)
  if (windows) {
    spawnSync('taskkill', ['/PID', String(run.pid), '/F'], {
      stdio: 'ignore',
      timeout: 60_000,
    })
  } else {
    try {
      process.kill(-run.pid, 'SIGKILL')
    } catch {}
  }
  process.exit(1)
}

setTimeout(() => fail(`the check ran past ${DEADLINE / 60_000} minutes`), DEADLINE).unref()

async function within(seconds, done) {
  for (let second = 0; second < seconds; second += 1) {
    if (await done()) {
      return true
    }
    await sleep(1000)
  }

  return done()
}

try {
  const listening = await within(180, async () => {
    if (exited) {
      throw new Error('pnpm dev exited before every app was listening')
    }
    return (await held()).length === ports.length
  })

  if (!listening) {
    await fail('not every app was listening within three minutes')
  }

  // Taken while every process still points at its parent, so the list is complete.
  started = tree(run.pid)
  say(
    `→ listening; ${started.length} processes in the run: ${started.map((p) => p.name).join(', ')}`,
  )
  say('→ Ctrl+C')
  pressCtrlC(run)

  if (!(await within(90, () => exited))) {
    await fail('pnpm dev was still running ninety seconds after Ctrl+C')
  }

  // ports.mjs waits for the ports before it exits; a little patience covers what the system has not reaped yet.
  const clean = await within(60, async () => {
    const now = processes()
    const running = started.some(({ pid, created }) =>
      now.some((process) => process.pid === pid && process.created === created),
    )
    return !running && (await held()).length === 0 && fromProject().length === 0
  })

  if (!clean) {
    await fail('Ctrl+C left something behind')
  }

  say(`→ every process stopped and ports ${ports.join(', ')} are free`)
  process.exit(0)
} catch (error) {
  await fail(error instanceof Error ? error.message : String(error))
}
