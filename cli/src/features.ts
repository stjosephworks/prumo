import { existsSync } from 'node:fs'
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Template } from './apps.ts'
import { setJsonc } from './jsonc.ts'

// What a project may leave out. The templates ship with every one of them; a project that answered no receives the
// template without it: these files deleted, these dependencies removed, and every line or block marked
// `// prumo:<feature>` cut, READMEs included. A feature a template does not list has nothing to cut there.
export const FEATURE_NAMES = [
  'mcp',
  'password',
  'email-code',
  'phone-code',
  'code-sign-in',
  'codes',
  'mail',
  'sms',
  'email',
  'social',
  'google',
  'apple',
] as const

export type Feature = (typeof FEATURE_NAMES)[number]

export type Enabled = Record<Feature, boolean>

export const SOCIAL_PROVIDERS = ['google', 'apple'] as const

export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

// How a person signs in: any of them, at least one.
export const SIGN_IN_METHODS = ['password', 'email-code', 'phone-code'] as const

export type SignInMethod = (typeof SIGN_IN_METHODS)[number]

export const NONE: Enabled = Object.fromEntries(
  FEATURE_NAMES.map((feature) => [feature, false]),
) as Enabled

export function enabledFor(answers: {
  mcp: boolean
  signIn: SignInMethod[]
  email: boolean
  social: SocialProvider[]
}): Enabled {
  const emailCode = answers.signIn.includes('email-code')
  const phoneCode = answers.signIn.includes('phone-code')

  return {
    mcp: answers.mcp,
    password: answers.signIn.includes('password'),
    'email-code': emailCode,
    'phone-code': phoneCode,
    // What more than one feature shares is enabled by any of them.
    'code-sign-in': emailCode || phoneCode,
    codes: answers.email || emailCode || phoneCode,
    mail: answers.email || emailCode,
    sms: phoneCode,
    email: answers.email,
    social: answers.social.length > 0,
    google: answers.social.includes('google'),
    apple: answers.social.includes('apple'),
  }
}

type Spec = {
  files: Partial<Record<Template, string[]>>
  dependencies: Partial<Record<Template, string[]>>
}

export const FEATURES: Record<Feature, Spec> = {
  // The API's MCP is its server and the OAuth authorization server that issues its tokens, with the table that
  // holds an authorization in a migration of its own, so a project without MCP never creates it.
  mcp: {
    files: {
      api: [
        'src/infra/mcp',
        'src/domain/oauth',
        'src/infra/oauth',
        'src/infra/di/oauth.di.ts',
        'src/infra/http/fetch-bridge.ts',
        'src/infra/http/controllers/mcp.controller.ts',
        'src/infra/http/controllers/oauth.controller.ts',
        'src/infra/database/mikroorm/entities/authorization.schema.ts',
        'src/infra/database/mikroorm/repositories/mikroorm-authorization.repository.ts',
        'migrations/Migration20261005111547_create_authorization.ts',
        'test/domain/oauth',
        'test/infra/oauth',
        'test/infra/http/controllers/mcp.controller.spec.ts',
      ],
      'web-vite': [
        'src/features/oauth',
        'src/routes/_authenticated/consent.tsx',
        'test/features/oauth',
      ],
      'web-next': ['src/features/oauth', 'src/app/(signed-in)/consent', 'test/features/oauth'],
      'web-astro': ['src/features/oauth', 'src/pages/consent.astro', 'test/features/oauth'],
    },
    dependencies: {
      api: ['@modelcontextprotocol/client', '@modelcontextprotocol/server'],
      'web-vite': [],
      'web-next': [],
      'web-astro': [],
    },
  },
  // A password: the account created with one and signed into with it, its column in a migration of its own.
  password: {
    files: {
      api: [
        'src/domain/auth/dto/sign-in.dto.ts',
        'src/domain/auth/dto/sign-up.dto.ts',
        'src/domain/auth/errors/invalid-credentials.error.ts',
        'src/domain/auth/ports/password-hasher.port.ts',
        'src/domain/auth/use-cases/sign-in.use-case.ts',
        'src/domain/auth/use-cases/sign-up.use-case.ts',
        'src/infra/auth/argon2-password-hasher.adapter.ts',
        'src/infra/http/controllers/password.controller.ts',
        'migrations/Migration20261005111546_add_user_password.ts',
        'test/domain/auth/use-cases/sign-in.use-case.spec.ts',
        'test/domain/auth/use-cases/sign-up.use-case.spec.ts',
        'test/infra/auth/argon2-password-hasher.adapter.spec.ts',
        'test/infra/http/controllers/password.controller.spec.ts',
        'test/support/fakes/fake-password-hasher.ts',
      ],
      'web-vite': [
        'src/features/auth/sign-in-form.tsx',
        'src/features/auth/sign-up-form.tsx',
        'src/routes/sign-up.tsx',
        'test/features/auth/password.spec.tsx',
        'test/support/with-password.ts',
      ],
      'web-next': [
        'src/features/auth/sign-in-form.tsx',
        'src/features/auth/sign-up-form.tsx',
        'src/app/(auth)/sign-up',
        'test/features/auth/password.spec.tsx',
      ],
      'web-astro': [
        'src/features/auth/sign-in-form.tsx',
        'src/features/auth/sign-up-form.tsx',
        'src/pages/sign-up.astro',
        'test/features/auth/password.spec.tsx',
      ],
      mobile: [
        'src/features/auth/sign-in-form.tsx',
        'src/features/auth/sign-up-form.tsx',
        'src/app/(auth)/sign-up.tsx',
        'test/features/auth/password.spec.tsx',
      ],
    },
    dependencies: { api: ['@node-rs/argon2'] },
  },
  // One-time codes, whatever they are for: the table, its limits, and the keyed digest, in a migration of their own.
  codes: {
    files: {
      api: [
        'src/domain/auth/entities/one-time-code.entity.ts',
        'src/domain/auth/ports/one-time-codes.port.ts',
        'src/domain/auth/repositories/one-time-code.repository.ts',
        'src/domain/auth/errors/invalid-code.error.ts',
        'src/domain/auth/errors/too-many-codes.error.ts',
        'src/domain/auth/use-cases/issue-code.use-case.ts',
        'src/infra/codes',
        'src/infra/di/codes.di.ts',
        'src/infra/database/mikroorm/entities/one-time-code.schema.ts',
        'src/infra/database/mikroorm/repositories/mikroorm-one-time-code.repository.ts',
        'migrations/Migration20261005111549_create_one_time_code.ts',
        'test/infra/codes',
        'test/infra/database/mikroorm/repositories/mikroorm-one-time-code.repository.spec.ts',
        'test/support/fakes/fake-one-time-codes.ts',
        'test/support/fakes/in-memory-one-time-code.repository.ts',
      ],
      'web-vite': ['src/features/forms/use-cooldown.ts'],
      'web-next': ['src/features/forms/use-cooldown.ts'],
      'web-astro': ['src/features/forms/use-cooldown.ts'],
      mobile: ['src/features/forms/use-cooldown.ts'],
    },
    dependencies: {},
  },
  // Mail: the Mailer port and the adapter that logs it, for whatever sends a code by email.
  mail: {
    files: {
      api: [
        'src/domain/auth/ports/mailer.port.ts',
        'src/domain/auth/dto/email-request.dto.ts',
        'src/infra/email',
        'test/support/fakes/fake-mailer.ts',
      ],
    },
    dependencies: {},
  },
  // Verification and password reset of a password account, by a code sent through the Mailer port.
  email: {
    files: {
      api: [
        'src/domain/auth/errors/email-not-verified.error.ts',
        'src/domain/auth/dto/verify-email.dto.ts',
        'src/domain/auth/dto/reset-password.dto.ts',
        'src/domain/auth/use-cases/request-email-verification.use-case.ts',
        'src/domain/auth/use-cases/verify-email.use-case.ts',
        'src/domain/auth/use-cases/request-password-reset.use-case.ts',
        'src/domain/auth/use-cases/reset-password.use-case.ts',
        'src/infra/http/controllers/auth-email.controller.ts',
        'test/domain/auth/use-cases/email.use-case.spec.ts',
        'test/infra/http/controllers/auth-email.controller.spec.ts',
      ],
      'web-vite': [
        'src/features/auth/verify-email-form.tsx',
        'src/features/auth/forgot-password-form.tsx',
        'src/features/auth/reset-password-form.tsx',
        'src/routes/verify-email.tsx',
        'src/routes/forgot-password.tsx',
        'src/routes/reset-password.tsx',
        'test/features/auth/email-flows.spec.tsx',
      ],
      'web-next': [
        'src/features/auth/verify-email-form.tsx',
        'src/features/auth/forgot-password-form.tsx',
        'src/features/auth/reset-password-form.tsx',
        'src/app/(auth)/verify-email',
        'src/app/(auth)/forgot-password',
        'src/app/(auth)/reset-password',
        'test/features/auth/email-flows.spec.tsx',
      ],
      'web-astro': [
        'src/features/auth/verify-email-form.tsx',
        'src/features/auth/forgot-password-form.tsx',
        'src/features/auth/reset-password-form.tsx',
        'src/pages/verify-email.astro',
        'src/pages/forgot-password.astro',
        'src/pages/reset-password.astro',
        'test/features/auth/email-flows.spec.tsx',
      ],
      mobile: [
        'src/features/auth/verify-email-form.tsx',
        'src/features/auth/forgot-password-form.tsx',
        'src/features/auth/reset-password-form.tsx',
        'src/app/(auth)/verify-email.tsx',
        'src/app/(auth)/forgot-password.tsx',
        'src/app/(auth)/reset-password.tsx',
        'test/features/auth/email-flows.spec.tsx',
      ],
    },
    dependencies: {},
  },
  // Sign-in by a code sent to an email address, which creates the account the first time.
  'email-code': {
    files: {
      api: [
        'src/domain/auth/dto/email-sign-in.dto.ts',
        'src/domain/auth/use-cases/request-sign-in-code.use-case.ts',
        'src/domain/auth/use-cases/sign-in-with-code.use-case.ts',
        'src/infra/http/controllers/email-code.controller.ts',
        'test/domain/auth/use-cases/email-code.use-case.spec.ts',
        'test/infra/http/controllers/email-code.controller.spec.ts',
      ],
    },
    dependencies: {},
  },
  // Sign-in by a code texted to a mobile number, read as E.164 and sent only to the countries in SMS_COUNTRIES.
  'phone-code': {
    files: {
      api: [
        'src/domain/auth/dto/phone-request.dto.ts',
        'src/domain/auth/dto/phone-sign-in.dto.ts',
        'src/domain/auth/errors/invalid-phone.error.ts',
        'src/domain/auth/ports/phone-numbers.port.ts',
        'src/domain/auth/use-cases/request-phone-code.use-case.ts',
        'src/domain/auth/use-cases/sign-in-with-phone-code.use-case.ts',
        'src/infra/sms/libphonenumber-phone-numbers.adapter.ts',
        'src/infra/http/controllers/phone-code.controller.ts',
        'migrations/Migration20261005111548_add_user_phone.ts',
        'test/domain/auth/use-cases/phone-code.use-case.spec.ts',
        'test/infra/http/controllers/phone-code.controller.spec.ts',
        'test/infra/sms/libphonenumber-phone-numbers.adapter.spec.ts',
      ],
    },
    dependencies: { api: ['libphonenumber-js'] },
  },
  // The screens that sign in by a code, whichever channels it goes by.
  'code-sign-in': {
    files: {
      'web-vite': ['src/features/auth/code-sign-in-form.tsx', 'test/features/auth/code.spec.tsx'],
      'web-next': ['src/features/auth/code-sign-in-form.tsx', 'test/features/auth/code.spec.tsx'],
      'web-astro': ['src/features/auth/code-sign-in-form.tsx', 'test/features/auth/code.spec.tsx'],
      mobile: ['src/features/auth/code-sign-in-form.tsx', 'test/features/auth/code.spec.tsx'],
    },
    dependencies: {},
  },
  // Text messages: the TextMessages port and the adapter that logs it.
  sms: {
    files: {
      api: [
        'src/domain/auth/ports/text-messages.port.ts',
        'src/infra/sms/log-text-messages.adapter.ts',
        'test/support/fakes/fake-text-messages.ts',
      ],
    },
    dependencies: {},
  },
  // Sign-in with a provider: the OpenID adapter, the trip there and back, and the identities it links, with their
  // tables in a migration of their own. Google and Apple are cut by their markers alone.
  social: {
    files: {
      api: [
        'src/domain/auth/entities/identity.entity.ts',
        'src/domain/auth/entities/social-sign-in.entity.ts',
        'src/domain/auth/ports/identity-providers.port.ts',
        'src/domain/auth/repositories/identity.repository.ts',
        'src/domain/auth/repositories/social-sign-in.repository.ts',
        'src/domain/auth/errors/provider-not-configured.error.ts',
        'src/domain/auth/errors/provider-email-unverified.error.ts',
        'src/domain/auth/errors/social-sign-in-failed.error.ts',
        'src/domain/auth/use-cases/link-identity.use-case.ts',
        'src/domain/auth/use-cases/start-social-sign-in.use-case.ts',
        'src/domain/auth/use-cases/complete-social-sign-in.use-case.ts',
        'src/domain/auth/use-cases/exchange-social-code.use-case.ts',
        'src/infra/social',
        'src/infra/di/social.di.ts',
        'src/infra/http/controllers/social.controller.ts',
        'src/infra/database/mikroorm/entities/identity.schema.ts',
        'src/infra/database/mikroorm/entities/social-sign-in.schema.ts',
        'src/infra/database/mikroorm/repositories/mikroorm-identity.repository.ts',
        'src/infra/database/mikroorm/repositories/mikroorm-social-sign-in.repository.ts',
        'migrations/Migration20261005111550_create_identity_social_sign_in.ts',
        'test/domain/auth/use-cases/social.use-case.spec.ts',
        'test/infra/social',
        'test/infra/http/controllers/social.controller.spec.ts',
        'test/support/fakes/social-fakes.ts',
        'test/support/fake-oidc-server.ts',
      ],
      'web-vite': [
        'src/features/auth/social-buttons.tsx',
        'test/features/auth/social-buttons.spec.tsx',
      ],
      'web-next': [
        'src/features/auth/social-buttons.tsx',
        'test/features/auth/social-buttons.spec.tsx',
      ],
      'web-astro': [
        'src/features/auth/social-buttons.tsx',
        'test/features/auth/social-buttons.spec.tsx',
      ],
      mobile: [
        'src/features/auth/social-buttons.tsx',
        'test/features/auth/social-buttons.spec.tsx',
      ],
    },
    dependencies: { api: ['openid-client'] },
  },
  google: { files: {}, dependencies: {} },
  apple: { files: {}, dependencies: {} },
}

export function cutFeature(text: string, feature: Feature, keep: boolean, file = 'a file'): string {
  // Inside JSX a comment is written {/* … */}, in an env file with #, and in Markdown as <!-- … -->, so a block may
  // open and close any of these ways.
  const start = new RegExp(
    `^\\s*(// prumo:${feature}|\\{/\\* prumo:${feature} \\*/\\}|# prumo:${feature}|<!-- prumo:${feature} -->)$`,
  )
  const end = new RegExp(
    `^\\s*(// prumo:end-${feature}|\\{/\\* prumo:end-${feature} \\*/\\}|# prumo:end-${feature}|<!-- prumo:end-${feature} -->)$`,
  )
  // A marked import keeps its marker as a trailing comment, which the import sorter carries along.
  const marked = new RegExp(`\\s*(//|#) prumo:${feature}$`)
  const kept: string[] = []
  let inBlock = false

  for (const line of text.split('\n')) {
    if (start.test(line)) {
      if (inBlock) {
        throw new Error(`${file} opens a prumo:${feature} block inside another`)
      }
      inBlock = true
    } else if (end.test(line)) {
      if (!inBlock) {
        throw new Error(`${file} closes a prumo:${feature} block it never opened`)
      }
      inBlock = false
    } else if (marked.test(line)) {
      if (keep) {
        kept.push(line.replace(marked, ''))
      }
    } else if (keep || !inBlock) {
      kept.push(line)
    }
  }

  if (inBlock) {
    throw new Error(`${file} leaves a prumo:${feature} block open`)
  }

  return kept.join('\n')
}

// A union whose members a feature cuts keeps one member a line in the template, which only this comment holds
// against the formatter. A project has its features settled, so the comment goes and the formatter has its way.
const KEEP_MEMBERS =
  /^[ \t]*\/\/ biome-ignore format: one member a line, so cutting a feature cuts its own\n/gm

export function cutFeatures(text: string, enabled: Enabled, file = 'a file'): string {
  return FEATURE_NAMES.reduce(
    (current, feature) => cutFeature(current, feature, enabled[feature], file),
    text,
  ).replace(KEEP_MEMBERS, '')
}

async function sourceFiles(directory: string): Promise<string[]> {
  if (!existsSync(directory)) {
    return []
  }

  const entries = await readdir(directory, { withFileTypes: true, recursive: true })

  return (
    entries
      // An Astro page carries markers too, around the island a feature brings.
      .filter((entry) => entry.isFile() && /\.(tsx?|astro)$/.test(entry.name))
      .map((entry) => join(entry.parentPath, entry.name))
  )
}

export async function applyFeatures(
  app: string,
  template: Template,
  enabled: Enabled,
): Promise<void> {
  const sources = [
    ...(await sourceFiles(join(app, 'src'))),
    ...(await sourceFiles(join(app, 'test'))),
    // The settings a feature needs are cut with it, and so is what the README says about it.
    join(app, '.env.example'),
    join(app, 'README.md'),
  ]
  const manifest = join(app, 'package.json')
  let pkg = await readFile(manifest, 'utf8')
  const dropped: string[] = []

  for (const feature of FEATURE_NAMES) {
    if (enabled[feature]) {
      continue
    }

    for (const file of FEATURES[feature].files[template] ?? []) {
      await rm(join(app, file), { recursive: true, force: true })
    }

    for (const dependency of FEATURES[feature].dependencies[template] ?? []) {
      dropped.push(dependency)
      for (const section of ['dependencies', 'devDependencies']) {
        pkg = setJsonc(pkg, [section, dependency], undefined)
      }
    }
  }

  await writeFile(manifest, pkg)

  for (const source of sources) {
    if (!existsSync(source)) {
      continue
    }

    const text = await readFile(source, 'utf8')
    const cut = cutFeatures(text, enabled, source)

    if (dropped.some((dependency) => cut.includes(`'${dependency}`))) {
      throw new Error(`${source} still imports a package that was removed, outside its marker`)
    }

    if (cut !== text) {
      await writeFile(source, cut)
    }
  }
}
