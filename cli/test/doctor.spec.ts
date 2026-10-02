import { describe, expect, it } from 'vitest'
import { doctor, type Probe } from '../src/doctor.ts'

const EVERYTHING = {
  'pnpm --version': '12.3.4',
  'git --version': 'git version 2.54.0',
  'docker --version': 'Docker version 29.7.2',
  'docker info': '',
}

function probe(commands: Record<string, string> = EVERYTHING, nodeVersion = '22.18.0'): Probe {
  return {
    nodeVersion,
    run: (command, args) => {
      const stdout = commands[[command, ...args].join(' ')]
      return { ok: stdout !== undefined, stdout: stdout ?? '' }
    },
  }
}

const check = (report: Awaited<ReturnType<typeof doctor>>, id: string) =>
  report.checks.find((entry) => entry.id === id)

describe('doctor', () => {
  it('is ready when everything answers', async () => {
    const report = await doctor(probe())

    expect(report.ready).toBe(true)
    expect(report.checks.map((entry) => [entry.id, entry.status])).toEqual([
      ['node', 'ok'],
      ['pnpm', 'ok'],
      ['git', 'ok'],
      ['docker', 'ok'],
    ])
  })

  it('fails on a Node below the floor, and on a missing pnpm or git', async () => {
    const report = await doctor(probe({}, '22.17.9'))

    expect(report.ready).toBe(false)
    expect(check(report, 'node')?.status).toBe('fail')
    expect(check(report, 'pnpm')?.status).toBe('fail')
    expect(check(report, 'git')?.status).toBe('fail')
  })

  it('fails on a pnpm too old for the generated workspaces', async () => {
    const report = await doctor(probe({ ...EVERYTHING, 'pnpm --version': '10.25.9' }))

    expect(report.ready).toBe(false)
    expect(check(report, 'pnpm')).toMatchObject({ status: 'fail' })
    expect(check(report, 'pnpm')?.detail).toContain('10.26.0 or later')
  })

  it('only warns about Docker, telling installed from running', async () => {
    const stopped = await doctor(
      probe({ 'pnpm --version': '12.0.0', 'git --version': 'git', 'docker --version': 'Docker' }),
    )
    const missing = await doctor(probe({ 'pnpm --version': '12.0.0', 'git --version': 'git' }))

    expect(stopped.ready).toBe(true)
    expect(check(stopped, 'docker')).toMatchObject({ status: 'warn' })
    expect(check(stopped, 'docker')?.detail).toContain('open Docker Desktop')
    expect(check(missing, 'docker')?.detail).toContain('install Docker Desktop')
  })
})
