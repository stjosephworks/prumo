import { runCommand } from './command.ts'

export type Status = 'ok' | 'warn' | 'fail'

export type Check = {
  id: string
  label: string
  status: Status
  detail: string
  required: boolean
}

export type Report = { ready: boolean; checks: Check[] }

export type Probe = {
  nodeVersion: string
  run: (command: string, args: string[]) => { ok: boolean; stdout: string }
}

const NODE_FLOOR = [22, 18, 0]

// Every generated workspace approves dependency builds with `allowBuilds`, which pnpm added in 10.26.0.
const PNPM_FLOOR = [10, 26, 0]

export const systemProbe: Probe = {
  nodeVersion: process.versions.node,
  run: (command, args) => {
    const result = runCommand(command, args, { encoding: 'utf8', timeout: 10_000 })

    return {
      ok: result.error === undefined && result.status === 0,
      stdout: String(result.stdout ?? ''),
    }
  },
}

function atLeast(version: string, floor: number[]): boolean {
  const parts = version.split('.').map(Number)

  for (const [index, minimum] of floor.entries()) {
    const part = parts[index] ?? 0
    if (part !== minimum) {
      return part > minimum
    }
  }

  return true
}

function firstLine(text: string): string {
  return text.trim().split('\n')[0] ?? ''
}

const TOOLS = {
  pnpm: { why: 'installs and runs every generated project', floor: PNPM_FLOOR },
  git: { why: 'every generated project starts as a repository', floor: undefined },
}

export type Tool = keyof typeof TOOLS

export function toolChecks(probe: Probe, tools: Tool[]): Check[] {
  return tools.map((id): Check => {
    const { why, floor } = TOOLS[id]
    const result = probe.run(id, ['--version'])
    const version = firstLine(result.stdout)
    const base = { id, label: id, required: true }

    if (!result.ok) {
      return { ...base, status: 'fail', detail: `not found; it ${why}` }
    }

    if (floor !== undefined && !atLeast(version, floor)) {
      return {
        ...base,
        status: 'fail',
        detail: `${version}; ${floor.join('.')} or later is required`,
      }
    }

    return { ...base, status: 'ok', detail: version }
  })
}

export async function doctor(probe: Probe = systemProbe): Promise<Report> {
  const checks: Check[] = []

  checks.push({
    id: 'node',
    label: 'Node',
    required: true,
    ...(atLeast(probe.nodeVersion, NODE_FLOOR)
      ? { status: 'ok', detail: probe.nodeVersion }
      : { status: 'fail', detail: `${probe.nodeVersion}; 22.18.0 or later is required` }),
  })

  checks.push(...toolChecks(probe, ['pnpm', 'git']))

  const docker = probe.run('docker', ['--version'])
  const engine = docker.ok ? probe.run('docker', ['info', '--format', '{{.OSType}}']) : undefined
  const os = firstLine(engine?.stdout ?? '')

  checks.push({
    id: 'docker',
    label: 'Docker',
    required: false,
    ...(engine?.ok !== true
      ? {
          status: 'warn',
          detail: docker.ok
            ? 'installed but not running; open Docker Desktop. The API runs its database and tests in it'
            : 'not found; install Docker Desktop, on Windows with the WSL2 backend. The API runs its database and tests in it',
        }
      : os !== 'linux'
        ? {
            status: 'warn',
            detail: `running ${os || 'unknown'} containers; switch Docker Desktop to Linux containers. The API's Postgres image is a Linux one`,
          }
        : { status: 'ok', detail: firstLine(docker.stdout) }),
  })

  return { ready: checks.every((check) => !check.required || check.status === 'ok'), checks }
}

const SYMBOL: Record<Status, string> = { ok: '✓', warn: '!', fail: '✗' }

export function doctorText(report: Report): string {
  const width = Math.max(...report.checks.map((check) => check.label.length))
  const lines = report.checks.map(
    (check) => `${SYMBOL[check.status]} ${check.label.padEnd(width)}  ${check.detail}`,
  )

  lines.push(
    '',
    report.ready ? 'Ready.' : 'Not ready: fix what is marked ✗ before generating a project.',
  )

  return lines.join('\n')
}
