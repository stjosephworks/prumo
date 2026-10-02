import type { Asker } from './asker.ts'
import type { AppType } from './compose.ts'
import type { Answers } from './context.ts'
import { SOCIAL_PROVIDERS, type SocialProvider } from './features.ts'
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
  email: boolean
  noEmail: boolean
  social: string | undefined
  noSocial: boolean
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

// A warning does not stop generation: it names a consequence the developer may have chosen on purpose.
export type Resolved = Answers & { target: string; warnings: string[] }

function parseProviders(value: string): SocialProvider[] {
  const providers = value
    .split(',')
    .map((provider) => provider.trim())
    .filter((provider) => provider !== '')
  const unknown = providers.filter(
    (provider) => !SOCIAL_PROVIDERS.includes(provider as SocialProvider),
  )

  if (providers.length === 0 || unknown.length > 0) {
    throw new CliError(
      'invalid_input',
      `Unknown provider: ${unknown.join(', ') || '(none)'}. Choose from ${SOCIAL_PROVIDERS.join(', ')}, or pass --no-social.`,
    )
  }

  return [...new Set(providers)] as SocialProvider[]
}

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

  if (flags.email && flags.noEmail) {
    throw new CliError('invalid_input', 'Choose --email or --no-email, not both.')
  }

  if (flags.social !== undefined && flags.noSocial) {
    throw new CliError('invalid_input', 'Choose --social or --no-social, not both.')
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

  // Verification and password reset are the API's; every client of it then shows their screens.
  let email = false

  if (!types.includes('api')) {
    if (flags.email) {
      throw new CliError('invalid_input', '--email needs api in --types.')
    }
  } else if (flags.email || flags.noEmail) {
    email = flags.email
  } else if (asker !== undefined) {
    email = await asker.email()
  } else {
    missing('--email or --no-email')
  }

  // A provider sends the user back to a screen, so social sign-in needs a client beside the API.
  const socialCapable = types.includes('api') && (types.includes('web') || types.includes('mobile'))
  let social: SocialProvider[] = []

  if (!socialCapable) {
    if (flags.social !== undefined) {
      throw new CliError('invalid_input', '--social needs api, and web or mobile, in --types.')
    }
  } else if (flags.social !== undefined) {
    social = parseProviders(flags.social)
  } else if (flags.noSocial) {
    social = []
  } else if (asker !== undefined) {
    social = await asker.social()
  } else {
    missing('--social <providers> or --no-social')
  }

  const warnings: string[] = []

  if (types.includes('mobile') && social.includes('google') && !social.includes('apple')) {
    warnings.push(
      'The App Store asks an app offering Google sign-in to offer an equivalent privacy-preserving login too ' +
        '(App Review Guideline 4.8); Sign in with Apple is one. Add apple to --social before publishing on iOS.',
    )
  }

  if (social.length > 0 && !email) {
    warnings.push(
      'Without --email no password account is ever confirmed, so the first sign-in with a provider for an existing ' +
        "account's email removes its password: the owner keeps the account through the provider. --email avoids it.",
    )
  }

  return { name, types, architecture, multiTenant, mcp, email, social, target, warnings }
}
