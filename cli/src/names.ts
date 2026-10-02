import { readdirSync, statSync } from 'node:fs'
import { basename, resolve } from 'node:path'

const PROJECT_NAME = /^[a-z][a-z0-9-]*$/

// npm refuses a longer package name.
const MAX_LENGTH = 214

// In a workspace each app's package is named after its type, and `pnpm --filter <type>` would match the root too.
const RESERVED = ['api', 'web', 'mobile', 'site']

export function validateProjectName(name: string): string | undefined {
  if (!PROJECT_NAME.test(name)) {
    return 'Use lowercase letters, digits and hyphens, starting with a letter.'
  }

  if (name.length > MAX_LENGTH) {
    return `Use at most ${MAX_LENGTH} characters.`
  }

  if (RESERVED.includes(name)) {
    return 'That is the name an app takes inside a workspace; choose another.'
  }

  return undefined
}

// Why a directory cannot receive a project, or undefined when it can: it does not exist yet, or it is empty.
export function targetProblem(target: string): string | undefined {
  const stats = statSync(target, { throwIfNoEntry: false })

  if (stats === undefined) {
    return undefined
  }

  if (!stats.isDirectory()) {
    return `${target} already exists and is not a directory.`
  }

  if (readdirSync(target).length > 0) {
    return `${target} already exists and is not empty.`
  }

  return undefined
}

// `.` is the current directory, and the project takes its name; anything else is a new directory inside it.
export function projectAt(input: string, cwd: string): { name: string; target: string } {
  return input === '.'
    ? { name: basename(cwd), target: cwd }
    : { name: input, target: resolve(cwd, input) }
}

export function projectProblem(input: string, cwd: string): string | undefined {
  const { name, target } = projectAt(input, cwd)
  const invalid = validateProjectName(name)

  if (invalid !== undefined) {
    return input === '.'
      ? `This directory's name, "${name}", cannot name a project. ${invalid}`
      : invalid
  }

  return targetProblem(target)
}

export function schemeFor(name: string): string {
  return name.replaceAll('-', '')
}
