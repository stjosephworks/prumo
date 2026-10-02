import type { Asker } from './asker.ts'
import type { AppType } from './compose.ts'
import type { Answers } from './context.ts'
import { projectAt, targetProblem, validateProjectName } from './names.ts'
import { CliError } from './output.ts'

export type Flags = {
  name: string | undefined
  types: string | undefined
  alone: boolean
  monorepo: boolean
  multiTenant: boolean
  singleTenant: boolean
  mcp: boolean
  noMcp: boolean
}

const TYPES: AppType[] = ['api', 'web', 'mobile', 'site']

const TENANT_AWARE: AppType[] = ['api', 'web', 'mobile']

function missing(flag: string): never {
  throw new CliError(
    'needs_input',
    `Missing ${flag}. Outside an interactive terminal every answer must come from a flag.`,
  )
}

function parseTypes(value: string): AppType[] {
  const types = value
    .split(',')
    .map((type) => type.trim())
    .filter((type) => type !== '')
  const unknown = types.filter((type) => !TYPES.includes(type as AppType))

  if (types.length === 0) {
    throw new CliError('invalid_input', `--types is empty. Choose from ${TYPES.join(', ')}.`)
  }

  if (unknown.length > 0) {
    throw new CliError(
      'invalid_input',
      `Unknown type: ${unknown.join(', ')}. Choose from ${TYPES.join(', ')}.`,
    )
  }

  return [...new Set(types)] as AppType[]
}

export type Resolved = Answers & { target: string }

export async function resolveAnswers(
  flags: Flags,
  asker: Asker | undefined,
  cwd: string = process.cwd(),
): Promise<Resolved> {
  if (flags.alone && flags.monorepo) {
    throw new CliError('invalid_input', 'Choose --alone or --monorepo, not both.')
  }

  if (flags.mcp && flags.noMcp) {
    throw new CliError('invalid_input', 'Choose --mcp or --no-mcp, not both.')
  }

  if (flags.multiTenant && flags.singleTenant) {
    throw new CliError('invalid_input', 'Choose --multi-tenant or --single-tenant, not both.')
  }

  const input: string =
    flags.name ?? (asker === undefined ? missing('the project name') : await asker.name())
  const { name, target } = projectAt(input, cwd)
  const invalid = validateProjectName(name)

  if (invalid !== undefined) {
    const which = input === '.' ? ', taken from this directory' : ''
    throw new CliError('invalid_input', `Invalid project name "${name}"${which}. ${invalid}`)
  }

  // Before the other questions, so nobody answers them all for a directory that cannot take the project.
  const occupied = targetProblem(target)

  if (occupied !== undefined) {
    throw new CliError('target_not_empty', occupied)
  }

  let types: AppType[]

  if (flags.types !== undefined) {
    types = parseTypes(flags.types)
  } else if (asker !== undefined) {
    types = await asker.types()
  } else {
    missing('--types')
  }

  let architecture: Answers['architecture'] = 'alone'

  if (types.length > 1) {
    if (flags.alone) {
      throw new CliError(
        'invalid_input',
        '--alone holds a single type; several types make a workspace.',
      )
    }
    architecture = 'monorepo'
  } else if (flags.monorepo) {
    architecture = 'monorepo'
  } else if (!flags.alone && asker !== undefined) {
    architecture = await asker.architecture()
  }

  let multiTenant = false

  if (!types.some((type) => TENANT_AWARE.includes(type))) {
    if (flags.multiTenant) {
      throw new CliError(
        'invalid_input',
        `--multi-tenant needs one of ${TENANT_AWARE.join(', ')} in --types.`,
      )
    }
  } else if (flags.multiTenant || flags.singleTenant) {
    multiTenant = flags.multiTenant
  } else if (asker !== undefined) {
    multiTenant = await asker.multiTenant()
  } else {
    missing('--multi-tenant or --single-tenant')
  }

  // MCP authorizes through a sign-in and a consent page, which only a web app can serve.
  const mcpCapable = types.includes('api') && types.includes('web')
  let mcp = false

  if (!mcpCapable) {
    if (flags.mcp) {
      throw new CliError('invalid_input', '--mcp needs both api and web in --types.')
    }
  } else if (flags.mcp || flags.noMcp) {
    mcp = flags.mcp
  } else if (asker !== undefined) {
    mcp = await asker.mcp()
  } else {
    missing('--mcp or --no-mcp')
  }

  return { name, types, architecture, multiTenant, mcp, target }
}
