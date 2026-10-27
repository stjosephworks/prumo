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

// Where an app keeps its port, what it falls back to, and how its dev command is told about it. An app is known by
// the template it came from: a web app's is its framework's.
const TEMPLATES = {
  api: { key: 'PORT', fallback: 3000, flag: [] },
  'web-vite': { key: 'WEB_PORT', fallback: 5173, flag: ['--port', '--strictPort'] },
  'web-next': { key: 'WEB_PORT', fallback: 3200, flag: ['--port'] },
  'web-astro': { key: 'WEB_PORT', fallback: 4321, flag: ['--port'] },
  mobile: { key: 'METRO_PORT', fallback: 8081, flag: ['--port'] },
}

// A port that moves takes these with it: the key to write, in every app of which template. A list holds one URL per
// app, so only the moving app's entry changes.
const WEB_ORIGIN = [{ template: 'api', key: 'WEB_ORIGIN', list: true }]
const FOLLOWERS = {
  api: [
    { template: 'api', key: 'API_URL' },
    { template: 'web-vite', key: 'VITE_API_URL' },
    { template: 'web-next', key: 'NEXT_PUBLIC_API_URL' },
    { template: 'web-astro', key: 'PUBLIC_API_URL' },
    { template: 'mobile', key: 'EXPO_PUBLIC_API_URL' },
  ],
  'web-vite': WEB_ORIGIN,
  'web-next': WEB_ORIGIN,
  'web-astro': WEB_ORIGIN,
  mobile: [],
}

// A config written before frameworks has web apps with none, which were Vite's.
function templateOf(app) {
  return app.type === 'web' ? `web-${app.framework ?? 'vite'}` : app.type
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

function readConfig() {
  const path = join(root, '.prumo', 'config.json')

  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
}

// Every app of the project, as { name, type, template, directory }. .prumo/config.json lists the apps; one written
// before apps had names holds one per type, named after it. An alone project is its one app.
function projectApps() {
  const config = readConfig()

  if (!workspace) {
    // A template is run where it sits, under its own name; a project is named by its author, so only
    // .prumo/config.json says what it is.
    if (TEMPLATES[basename(root)] !== undefined) {
      const template = basename(root)
      const type = template.startsWith('web-') ? 'web' : template

      return [{ name: type, type, template, directory: root }]
    }

    const [listed] = config.apps ?? []
    const [first] = config.types ?? []
    const app = listed ?? (first === undefined ? undefined : { name: first, type: first })

    return app === undefined ? [] : [{ ...app, template: templateOf(app), directory: root }]
  }

  const listed = config.apps ?? (config.types ?? []).map((type) => ({ name: type, type }))

  return listed
    .map((app) => ({ ...app, template: templateOf(app), directory: join(root, 'apps', app.name) }))
    .filter(
      (app) =>
        TEMPLATES[app.template] !== undefined && existsSync(join(app.directory, 'package.json')),
    )
}

const apps = projectApps()

function appsToCheck() {
  return values.all ? apps : apps.filter((app) => app.directory === here)
}

function portOf(app) {
  const { key, fallback } = TEMPLATES[app.template]

  return Number(envValue(readEnv(app.directory), key) ?? fallback)
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
    const pids = new Set()

    // Windows translates the state column, so a listener is told by its remote address instead: only a socket that
    // is listening has none, which netstat writes as port 0.
    for (const line of lines.split('\n')) {
      const [protocol, local, remote, ...rest] = line.trim().split(/\s+/)
      const pid = rest.at(-1)

      if (
        protocol === 'TCP' &&
        local?.endsWith(`:${port}`) &&
        remote?.endsWith(':0') &&
        pid !== '0'
      ) {
        pids.add(pid)
      }
    }

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

  // tasklist answers a pid it does not know with a translated sentence, never with a quoted CSV row.
  return windows ? (/^"([^"]*)"/.exec(output)?.[1] ?? 'unknown') : basename(output || 'unknown')
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
      terminate(processTree([pid]))
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

function movePort(app, from, port) {
  const before = `http://localhost:${from}`
  const after = `http://localhost:${port}`

  writeEnvValue(app.directory, TEMPLATES[app.template].key, port)

  for (const follower of FOLLOWERS[app.template]) {
    for (const other of apps.filter((each) => each.template === follower.template)) {
      const current = envValue(readEnv(other.directory), follower.key)
      const entries = (current ?? '').split(',').map((entry) => entry.trim())
      const value =
        follower.list && current !== undefined
          ? (entries.includes(before)
              ? entries.map((entry) => (entry === before ? after : entry))
              : [...entries, after]
            ).join(',')
          : after

      writeEnvValue(other.directory, follower.key, value)
    }
  }
}

async function settle(app) {
  const port = portOf(app)

  if (!(await taken(port))) {
    return port
  }

  const found = holders(port)

  say(`${app.name} wants port ${port}, held by ${describe(found)}.`)

  const moved = async () => {
    const free = await nextFree(port)
    movePort(app, port, free)
    say(`${app.name} moved to port ${free}, written to .env.`)
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
      `Port ${port} is in use by ${describe(found)}. Pass --kill to stop it, or --change to move ${app.name} to the next free port.`,
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

// Windows has a precise answer to "what did this command start": a job object. A process created by a member of a job
// is a member too, whatever became of its parent, so the job's member list holds everything the command started,
// with no reading of the process tree to come too late. A PowerShell helper creates the job, puts this process in it
// before the command starts, and lists the members when asked.
const JOB_HELPER = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PrumoJob {
  [DllImport("kernel32.dll", SetLastError = true)] public static extern IntPtr CreateJobObject(IntPtr attributes, string name);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern IntPtr OpenProcess(uint access, bool inherit, uint id);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern bool SetConsoleCtrlHandler(IntPtr handler, bool ignore);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool QueryInformationJobObject(IntPtr job, int kind, IntPtr information, int length, IntPtr returned);
  public static string Members(IntPtr job) {
    int length = 8 + IntPtr.Size * 16384;
    IntPtr list = Marshal.AllocHGlobal(length);
    try {
      if (!QueryInformationJobObject(job, 3, list, length, IntPtr.Zero)) { return ""; }
      int count = Marshal.ReadInt32(list, 4);
      string[] ids = new string[count];
      for (int i = 0; i < count; i++) { ids[i] = Marshal.ReadIntPtr(list, 8 + i * IntPtr.Size).ToInt64().ToString(); }
      return String.Join(" ", ids);
    } finally {
      Marshal.FreeHGlobal(list);
    }
  }
}
'@
# Ctrl+C is for the command; the helper has to outlive it to list what is left.
[void][PrumoJob]::SetConsoleCtrlHandler([IntPtr]::Zero, $true)
$job = [PrumoJob]::CreateJobObject([IntPtr]::Zero, $null)
$member = [PrumoJob]::OpenProcess(0x0101, $false, [uint32]$env:PRUMO_JOB_MEMBER)
if ($job -eq [IntPtr]::Zero -or $member -eq [IntPtr]::Zero -or -not [PrumoJob]::AssignProcessToJobObject($job, $member)) { exit 1 }
[Console]::Out.WriteLine('ready')
while ($null -ne [Console]::In.ReadLine()) { [Console]::Out.WriteLine([PrumoJob]::Members($job)) }
`

// The job, or undefined where there is none: elsewhere than Windows, or when the helper could not make one, and then
// the process tree read on a schedule is what is left.
async function startJob() {
  if (!windows) {
    return undefined
  }

  const helper = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', JOB_HELPER], {
    stdio: ['pipe', 'pipe', 'ignore'],
    windowsHide: true,
    env: { ...process.env, PRUMO_JOB_MEMBER: String(process.pid) },
  })
  const lines = []
  const waiting = []
  let pending = ''

  helper.on('error', () => {})
  helper.stdin.on('error', () => {})
  helper.stdout.setEncoding('utf8')
  helper.stdout.on('data', (chunk) => {
    const parts = (pending + chunk).split('\n')

    pending = parts.pop() ?? ''
    for (const line of parts) {
      const resolve = waiting.shift()

      if (resolve === undefined) {
        lines.push(line.trim())
      } else {
        resolve(line.trim())
      }
    }
  })

  // A timer keeps this process alive while it waits, since the helper itself does not.
  const next = (ms) =>
    new Promise((resolve) => {
      const line = lines.shift()

      if (line !== undefined) {
        resolve(line)
        return
      }

      const timer = setTimeout(() => resolve(undefined), ms)

      waiting.push((value) => {
        clearTimeout(timer)
        resolve(value)
      })
    })

  if ((await next(60_000)) !== 'ready') {
    helper.kill()
    return undefined
  }

  helper.unref()
  helper.stdin.unref?.()
  helper.stdout.unref?.()

  return {
    members: async () => {
      helper.stdin.write('list\n')

      return ((await next(10_000)) ?? '')
        .split(' ')
        .map(Number)
        .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid)
    },
    close: () => helper.kill(),
  }
}

// Ends exactly these processes on Windows, and nothing else. `taskkill /T` is never used: it follows the same parent
// ids, which Windows does not keep honest, as processTree below explains.
function terminate(pids) {
  if (pids.length > 0) {
    spawnSync('taskkill', ['/F', ...pids.flatMap((pid) => ['/PID', String(pid)])], {
      stdio: 'ignore',
      timeout: 60_000,
    })
  }
}

// Every process below the ones given, as the system sees them right now.
//
// On Windows a process keeps its parent's id after the parent exits, and the id is then given to the next process
// that starts. A process of the run can so inherit the number that winlogon, dwm or csrss name as their parent, and a
// tree followed by ids alone adopts them: on the CI runner that once stopped the session itself. A child is therefore
// only taken as one when it started after its parent; a process that started before the one holding its parent's
// number cannot be that process's child.
function processTree(roots) {
  const listed = windows
    ? spawnSync(
        'powershell',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId) $(if ($_.CreationDate) { $_.CreationDate.ToFileTimeUtc() } else { 0 })" }',
        ],
        { encoding: 'utf8', timeout: 60_000 },
      )
    : spawnSync('ps', ['-eo', 'pid=,ppid='], { encoding: 'utf8', timeout: 60_000 })
  const started = new Map()
  const links = []

  for (const line of (listed.stdout ?? '').split('\n')) {
    const [child, parent, created] = line.trim().split(/\s+/).map(Number)

    if (Number.isInteger(child) && Number.isInteger(parent)) {
      links.push([child, parent])
      started.set(child, created ?? 0)
    }
  }

  const children = new Map()

  for (const [child, parent] of links) {
    const parentStarted = started.get(parent)
    const honest = !windows || parentStarted === undefined || parentStarted <= started.get(child)

    if (honest && child !== parent) {
      children.set(parent, [...(children.get(parent) ?? []), child])
    }
  }

  const tree = []
  const pending = [...roots]

  while (pending.length > 0) {
    const current = pending.shift()

    if (!tree.includes(current)) {
      tree.push(current)
      pending.push(...(children.get(current) ?? []))
    }
  }

  // Deepest first, so a parent does not restart what was just stopped. On Windows only what is running now: the number
  // of a process that exited may already name another one.
  return (windows ? tree.filter((pid) => started.has(pid)) : tree).reverse()
}

function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

function signal(pid, sign) {
  try {
    process.kill(pid, sign)
  } catch {}
}

// `pnpm -r --parallel` starts each app in a process group of its own, so the terminal's Ctrl+C reaches pnpm and
// nothing below it. Whatever was started here is therefore stopped from here, and never anything else: the tree is
// read before the first signal, while the processes still point at their parents.
async function shutdown(child, ports, known, job) {
  // With a job its members are exactly what the command started. Without one, on Windows, the tree is also read from
  // every process seen while the command ran, since a process keeps its parent's id after the parent exits; elsewhere
  // an orphan moves to init, and below a dead pid there is only whatever reused the number.
  const members = (await job?.members()) ?? []
  const roots = windows && job === undefined ? [child.pid, ...known] : [child.pid]
  const below = processTree(roots)
  const tree = [...new Set([...below, ...known, ...members])].reverse()
  const stopped = []

  if (windows) {
    terminate([...new Set([...below, ...members])])
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

      // The port is released once the system has reaped what was killed, which is not at once.
      if (ours.length > 0) {
        await freed(port)
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

async function supervise(child, ports, job) {
  // Ctrl+C reaches the child through the terminal; this process only waits, and then makes sure nothing survived.
  // Once the child is gone, its own children answer to the system and no longer to it, so who they were is
  // remembered while they are still running: on a schedule, and again the moment the signal arrives.
  const known = new Set([child.pid])
  // A job lists its members at the end, so with one there is nothing to remember on the way.
  const remember = () => {
    if (job !== undefined) {
      return
    }

    for (const pid of processTree([child.pid])) {
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

  // `pnpm -r --parallel` starts each app in a process group of its own, which the terminal's Ctrl+C never reaches, and
  // a Ctrl+C right after the start comes before the workspace's ports.mjs has seen the apps. So an app's ports.mjs
  // does not wait to be told: once whatever started it is gone, nobody is left to stop it, and it stops its own tree.
  const parent = process.ppid
  const orphaned = setInterval(() => {
    if (!interrupted && !alive(parent)) {
      interrupt('SIGTERM')
    }
  }, 250)

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
  clearInterval(orphaned)

  const stopped = await shutdown(child, ports, known, job)

  job?.close()

  process.off('SIGINT', onInterrupt)
  process.off('SIGTERM', onTerminate)
  process.exitCode = interrupted ? 0 : code

  return stopped
}

// On Windows the command is most often a .cmd shim, such as pnpm or vite, which Node starts only through a shell, and
// a shell given an argument list is deprecated (DEP0190). So it gets one line, each part quoted when it needs it.
function commandLine(parts) {
  return parts
    .map((part) => (/^[\w@+=:,./\\-]+$/.test(part) ? part : `"${part.replaceAll('"', '""')}"`))
    .join(' ')
}

async function main() {
  const ports = {}
  const [command, ...args] = positionals

  // PowerShell takes a few seconds to make the job, so it does while the ports are settled.
  const starting = command === undefined ? undefined : startJob()

  try {
    for (const app of appsToCheck()) {
      ports[app.name] = await settle(app)
    }
  } catch (error) {
    ;(await starting)?.close()
    throw error
  }

  if (command === undefined) {
    return { ports }
  }

  // Only an app tells its command which port to use. A workspace root wraps `pnpm`, which would pass a stray
  // `--port` on to every app it runs.
  const [app] = values.all ? [] : appsToCheck()
  const flag = app === undefined ? [] : TEMPLATES[app.template].flag
  const withPort = flag.flatMap((entry) =>
    entry === '--port' ? ['--port', String(ports[app.name])] : [entry],
  )
  // Before the command starts, so that it and everything it starts are members from their first instant.
  const job = await starting
  const child = windows
    ? spawn(commandLine([command, ...args, ...withPort]), { stdio: 'inherit', shell: true })
    : spawn(command, [...args, ...withPort], { stdio: 'inherit' })
  const stopped = await supervise(child, Object.values(ports), job)

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
