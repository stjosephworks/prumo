import { describe, expect, it } from 'vitest'
import { addApprovals, addToCatalogs } from '../src/workspace-yaml.ts'

const WORKSPACE = `packages:
  - apps/*
  - packages/*

catalog:
  'react': 19.2.0
  'zod': 4.6.4

allowBuilds:
  # Why the first one is denied.
  '@swc/core': false
`

describe('addToCatalogs', () => {
  it('adds what is missing and keeps the version the workspace holds', () => {
    const text = addToCatalogs(WORKSPACE, {
      default: { react: '19.1.0', vite: '8.3.0' },
      named: { tailwind3: { tailwindcss: '3.4.17' } },
    })

    expect(text).toContain("  'react': 19.2.0\n  'zod': 4.6.4\n  'vite': 8.3.0\n\nallowBuilds:")
    expect(text).not.toContain('19.1.0')
    expect(text).toMatch(/\ncatalogs:\n {2}tailwind3:\n {4}'tailwindcss': 3\.4\.17\n$/)
  })

  it('adds to a named catalog that is already there', () => {
    const named = `${WORKSPACE}\ncatalogs:\n  tailwind3:\n    'tailwindcss': 3.4.17\n`
    const text = addToCatalogs(named, {
      default: {},
      named: { tailwind3: { tailwindcss: '3.4.17', nativewind: '4.2.1' } },
    })

    expect(
      text.endsWith("  tailwind3:\n    'tailwindcss': 3.4.17\n    'nativewind': 4.2.1\n"),
    ).toBe(true)
  })
})

describe('addApprovals', () => {
  it('adds each approval once, with the comment that says why', () => {
    const text = addApprovals(WORKSPACE, [
      '  # Why the first one is denied.',
      "  '@swc/core': false",
      '  # Why sharp is denied.',
      '  sharp: false',
    ])

    expect(text).toBe(`${WORKSPACE}  # Why sharp is denied.\n  sharp: false\n`)
  })

  it('opens the block when the workspace had none', () => {
    expect(addApprovals('packages:\n  - apps/*\n', ['  sharp: false'])).toBe(
      'packages:\n  - apps/*\n\nallowBuilds:\n  sharp: false\n',
    )
  })
})
