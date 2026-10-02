import { existsSync } from 'node:fs'
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppType } from './compose.ts'
import { setJsonc } from './jsonc.ts'

// What a project may leave out. The templates ship with every one of them; a project that answered no receives the
// template without it: these files deleted, these dependencies removed, and every line or block marked
// `// prumo:<feature>` cut. A feature a type does not list has nothing to cut there.
export const FEATURE_NAMES = ['mcp', 'email', 'social', 'google', 'apple'] as const

export type Feature = (typeof FEATURE_NAMES)[number]

export type Enabled = Record<Feature, boolean>

export const SOCIAL_PROVIDERS = ['google', 'apple'] as const

export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

export const NONE: Enabled = {
  mcp: false,
  email: false,
  social: false,
  google: false,
  apple: false,
}

export function enabledFor(answers: {
  mcp: boolean
  email: boolean
  social: SocialProvider[]
}): Enabled {
  return {
    mcp: answers.mcp,
    email: answers.email,
    social: answers.social.length > 0,
    google: answers.social.includes('google'),
    apple: answers.social.includes('apple'),
  }
}

type Spec = {
  files: Partial<Record<AppType, string[]>>
  dependencies: Partial<Record<AppType, string[]>>
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
        'migrations/Migration20261002225916_create_authorization.ts',
        'test/domain/oauth',
        'test/infra/oauth',
        'test/infra/http/controllers/mcp.controller.spec.ts',
      ],
      web: ['src/features/oauth', 'src/routes/_authenticated/consent.tsx', 'test/features/oauth'],
    },
    dependencies: {
      api: ['@modelcontextprotocol/client', '@modelcontextprotocol/server'],
      web: [],
    },
  },
  // Verification and password reset: a code sent through the Mailer port, its table in a migration of its own.
  email: {
    files: {
      api: [
        'src/domain/auth/entities/email-code.entity.ts',
        'src/domain/auth/ports/mailer.port.ts',
        'src/domain/auth/ports/one-time-codes.port.ts',
        'src/domain/auth/repositories/email-code.repository.ts',
        'src/domain/auth/errors/email-not-verified.error.ts',
        'src/domain/auth/errors/invalid-code.error.ts',
        'src/domain/auth/dto/email-request.dto.ts',
        'src/domain/auth/dto/verify-email.dto.ts',
        'src/domain/auth/dto/reset-password.dto.ts',
        'src/domain/auth/use-cases/issue-email-code.use-case.ts',
        'src/domain/auth/use-cases/request-email-verification.use-case.ts',
        'src/domain/auth/use-cases/verify-email.use-case.ts',
        'src/domain/auth/use-cases/request-password-reset.use-case.ts',
        'src/domain/auth/use-cases/reset-password.use-case.ts',
        'src/infra/email',
        'src/infra/di/email.di.ts',
        'src/infra/http/controllers/auth-email.controller.ts',
        'src/infra/database/mikroorm/entities/email-code.schema.ts',
        'src/infra/database/mikroorm/repositories/mikroorm-email-code.repository.ts',
        'migrations/Migration20261002225917_create_email_code.ts',
        'test/domain/auth/use-cases/email.use-case.spec.ts',
        'test/infra/email',
        'test/infra/http/controllers/auth-email.controller.spec.ts',
        'test/support/fakes/fake-mailer.ts',
        'test/support/fakes/fake-one-time-codes.ts',
        'test/support/fakes/in-memory-email-code.repository.ts',
      ],
      web: [
        'src/features/auth/verify-email-form.tsx',
        'src/features/auth/forgot-password-form.tsx',
        'src/features/auth/reset-password-form.tsx',
        'src/routes/verify-email.tsx',
        'src/routes/forgot-password.tsx',
        'src/routes/reset-password.tsx',
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
        'migrations/Migration20261002231646_create_identity_social_sign_in.ts',
        'test/domain/auth/use-cases/social.use-case.spec.ts',
        'test/infra/social',
        'test/infra/http/controllers/social.controller.spec.ts',
        'test/support/fakes/social-fakes.ts',
        'test/support/fake-oidc-server.ts',
      ],
      web: ['src/features/auth/social-buttons.tsx', 'test/features/auth/social-buttons.spec.tsx'],
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
  // Inside JSX a comment is written {/* … */}, and in an env file with #, so a block may open and close any of
  // these ways.
  const start = new RegExp(
    `^\\s*(// prumo:${feature}|\\{/\\* prumo:${feature} \\*/\\}|# prumo:${feature})$`,
  )
  const end = new RegExp(
    `^\\s*(// prumo:end-${feature}|\\{/\\* prumo:end-${feature} \\*/\\}|# prumo:end-${feature})$`,
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

async function sourceFiles(directory: string): Promise<string[]> {
  if (!existsSync(directory)) {
    return []
  }

  const entries = await readdir(directory, { withFileTypes: true, recursive: true })

  return entries
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
}

export async function applyFeatures(app: string, type: AppType, enabled: Enabled): Promise<void> {
  const sources = [
    ...(await sourceFiles(join(app, 'src'))),
    ...(await sourceFiles(join(app, 'test'))),
    // The settings a feature needs are cut with it.
    join(app, '.env.example'),
  ]
  const manifest = join(app, 'package.json')
  let pkg = await readFile(manifest, 'utf8')
  const dropped: string[] = []

  for (const feature of FEATURE_NAMES) {
    if (enabled[feature]) {
      continue
    }

    for (const file of FEATURES[feature].files[type] ?? []) {
      await rm(join(app, file), { recursive: true, force: true })
    }

    for (const dependency of FEATURES[feature].dependencies[type] ?? []) {
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
    const cut = FEATURE_NAMES.reduce(
      (current, feature) => cutFeature(current, feature, enabled[feature], source),
      text,
    )

    if (dropped.some((dependency) => cut.includes(`'${dependency}`))) {
      throw new Error(`${source} still imports a package that was removed, outside its marker`)
    }

    if (cut !== text) {
      await writeFile(source, cut)
    }
  }
}
