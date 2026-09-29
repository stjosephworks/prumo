import type { Asker } from './asker.ts'
import type { AppType } from './compose.ts'
import type { Answers } from './context.ts'
import { validateProjectName } from './names.ts'
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
  const types = value.split(',').map((type) => type.trim())
  const unknown = types.filter((type) => !TYPES.includes(type as AppType))

  if (unknown.length > 0 || types.length === 0) {
    throw new CliError(
      'invalid_input',
      `Unknown type: ${unknown.join(', ')}. Choose from ${TYPES.join(', ')}.`,
    )
  }

  return [...new Set(types)] as AppType[]
}

export async function resolveAnswers(flags: Flags, asker: Asker | undefined): Promise<Answers> {
  if (flags.alone && flags.monorepo) {
    throw new CliError('invalid_input', 'Choose --alone or --monorepo, not both.')
  }

  if (flags.mcp && flags.noMcp) {
    throw new CliError('invalid_input', 'Choose --mcp or --no-mcp, not both.')
  }

  if (flags.multiTenant && flags.singleTenant) {
    throw new CliError('invalid_input', 'Choose --multi-tenant or --single-tenant, not both.')
  }

  const name: string =
    flags.name ?? (asker === undefined ? missing('the project name') : await asker.name())

  const invalid = validateProjectName(name)

  if (invalid !== undefined) {
    throw new CliError('invalid_input', `Invalid project name "${name}". ${invalid}`)
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

  if (types.some((type) => TENANT_AWARE.includes(type))) {
    if (flags.multiTenant || flags.singleTenant) {
      multiTenant = flags.multiTenant
    } else if (asker !== undefined) {
      multiTenant = await asker.multiTenant()
    } else {
      missing('--multi-tenant or --single-tenant')
    }
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

  return { name, types, architecture, multiTenant, mcp }
}
