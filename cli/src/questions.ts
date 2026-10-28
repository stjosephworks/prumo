import {
  type App,
  defaultApps,
  parseApp,
  parseTypeEntry,
  TYPES,
  type TypeEntry,
  typesOf,
  validateApps,
} from './apps.ts'
import type { Asker } from './asker.ts'
import type { AppType } from './compose.ts'
import type { Answers } from './context.ts'
import {
  SIGN_IN_METHODS,
  type SignInMethod,
  SOCIAL_PROVIDERS,
  type SocialProvider,
} from './features.ts'
import { projectAt, targetProblem, validateProjectName } from './names.ts'
import { CliError } from './output.ts'

export type Flags = {
  name: string | undefined
  types: string | undefined
  apps: string[] | undefined
  alone: boolean
  monorepo: boolean
  multiTenant: boolean
  singleTenant: boolean
  mcp: boolean
  noMcp: boolean
  signIn: string | undefined
  email: boolean
  noEmail: boolean
  social: string | undefined
  noSocial: boolean
}

function missing(flag: string): never {
  throw new CliError(
    'needs_input',
    `Missing ${flag}. Outside an interactive terminal every answer must come from a flag.`,
  )
}

// A type given twice is given once; `web` and `web:next` together are two answers to one question.
function parseTypes(value: string): TypeEntry[] {
  const entries = value
    .split(',')
    .map((type) => type.trim())
    .filter((type) => type !== '')
    .map((type) => parseTypeEntry(type, '--types'))

  if (entries.length === 0) {
    throw new CliError('invalid_input', `--types is empty. Choose from ${TYPES.join(', ')}.`)
  }

  const unique: TypeEntry[] = []

  for (const entry of entries) {
    const same = unique.find((each) => each.type === entry.type)

    if (same === undefined) {
      unique.push(entry)
    } else if (same.framework !== entry.framework) {
      throw new CliError(
        'invalid_input',
        `--types names ${entry.type} twice; a second ${entry.type} app is --app <name>=${entry.type}.`,
      )
    }
  }

  return unique
}

// A warning does not stop generation: it names a consequence the developer may have chosen on purpose.
export type Resolved = Answers & { apps: App[]; target: string; warnings: string[] }

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

// At least one: a project signed into only through a provider has no way back in for someone whose provider account
// is gone.
function parseSignIn(value: string): SignInMethod[] {
  const methods = value
    .split(',')
    .map((method) => method.trim())
    .filter((method) => method !== '')
  const unknown = methods.filter((method) => !SIGN_IN_METHODS.includes(method as SignInMethod))

  if (methods.length === 0 || unknown.length > 0) {
    throw new CliError(
      'invalid_input',
      `Unknown sign-in method: ${unknown.join(', ') || '(none)'}. Choose one or more of ${SIGN_IN_METHODS.join(', ')}.`,
    )
  }

  return [...new Set(methods)] as SignInMethod[]
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

  const named = (flags.apps ?? []).map(parseApp)
  let entries: (AppType | TypeEntry)[]

  if (flags.types !== undefined) {
    entries = parseTypes(flags.types)
  } else if (named.length > 0) {
    entries = []
  } else if (asker !== undefined) {
    entries = await asker.types()
  } else {
    missing('--types')
  }

  // The types answered take their own names; an app named on purpose comes after them.
  let apps: App[] = [...defaultApps(entries), ...named]
  let architecture: Answers['architecture']

  if (named.length > 0 && flags.alone) {
    throw new CliError('invalid_input', '--app names an app inside a workspace; drop --alone.')
  }

  if (apps.length > 1 || named.length > 0) {
    if (flags.alone) {
      throw new CliError(
        'invalid_input',
        '--alone holds a single type; several types make a workspace.',
      )
    }
    architecture = 'monorepo'
  } else if (flags.alone || flags.monorepo) {
    architecture = flags.monorepo ? 'monorepo' : 'alone'
  } else if (asker !== undefined) {
    architecture = await asker.architecture()
  } else {
    missing('--alone or --monorepo')
  }

  // Renaming an app, or adding another web app, is for those who ask: offered once, after the types were asked
  // rather than passed, and answered no by default. With flags, --app says it.
  if (
    architecture === 'monorepo' &&
    flags.types === undefined &&
    named.length === 0 &&
    asker !== undefined
  ) {
    apps = await asker.apps(apps, name)
  }

  // A web app's framework is asked when its type was, and is Vite when a flag gave the type without one.
  const asksFramework = flags.types === undefined && named.length === 0 && asker !== undefined
  const framed: App[] = []

  for (const app of apps) {
    if (app.type !== 'web' || app.framework !== undefined) {
      framed.push(app)
    } else {
      framed.push({ ...app, framework: asksFramework ? await asker.framework(app.name) : 'vite' })
    }
  }

  apps = framed
  validateApps(apps, name)
  const types = typesOf(apps)

  // Every type carries tenant-aware conventions, so the question is always asked.
  let multiTenant = false

  if (flags.multiTenant || flags.singleTenant) {
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

  // How a person signs in is the API's to offer; a project without one keeps the clients' password screens.
  let signIn: SignInMethod[] = ['password']

  if (!types.includes('api')) {
    if (flags.signIn !== undefined) {
      throw new CliError('invalid_input', '--sign-in needs api in --types.')
    }
  } else if (flags.signIn !== undefined) {
    signIn = parseSignIn(flags.signIn)
  } else if (asker !== undefined) {
    signIn = await asker.signIn()
  } else {
    missing('--sign-in <methods>')
  }

  // Verification and password reset are the API's, and only a password account has them.
  let email = false

  if (!types.includes('api')) {
    if (flags.email) {
      throw new CliError('invalid_input', '--email needs api in --types.')
    }
  } else if (!signIn.includes('password')) {
    if (flags.email) {
      throw new CliError(
        'invalid_input',
        '--email confirms addresses and resets passwords; it needs password in --sign-in.',
      )
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

  if (types.includes('mobile') && !signIn.includes('password')) {
    warnings.push(
      'App Review and Google Play review sign in to the app, and cannot read the inbox or phone a code goes to. ' +
        'Before submitting, set REVIEW_SIGN_IN on the API to an address you hold and a code: .prumo/api/auth.md.',
    )
  }

  if (signIn.includes('phone-code')) {
    warnings.push(
      'Sign-in by phone texts its codes to the log until the TextMessages port gets a provider, and only to the ' +
        'countries in SMS_COUNTRIES, US until you change it. Set both before going live: .prumo/phone/.',
    )
  }

  if (social.length > 0 && signIn.includes('password') && !email) {
    warnings.push(
      'Without --email no password account is ever confirmed, so the first sign-in with a provider for an existing ' +
        "account's email removes its password: the owner keeps the account through the provider. --email avoids it.",
    )
  }

  return {
    name,
    types,
    apps,
    architecture,
    multiTenant,
    mcp,
    signIn,
    email,
    social,
    target,
    warnings,
  }
}
