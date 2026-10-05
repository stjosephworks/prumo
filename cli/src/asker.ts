import * as prompt from '@clack/prompts'
import type { AppType } from './compose.ts'
import type { Answers } from './context.ts'
import { SOCIAL_PROVIDERS, type SocialProvider } from './features.ts'

export type Asker = {
  name: () => Promise<string>
  types: () => Promise<AppType[]>
  architecture: () => Promise<Answers['architecture']>
  multiTenant: () => Promise<boolean>
  mcp: () => Promise<boolean>
  email: () => Promise<boolean>
  social: () => Promise<SocialProvider[]>
}

const TYPES: AppType[] = ['api', 'web', 'mobile', 'site']

function answered<T>(value: T): Exclude<T, symbol> {
  if (prompt.isCancel(value)) {
    prompt.cancel('Nothing was generated.')
    process.exit(1)
  }

  return value as Exclude<T, symbol>
}

export function terminalAsker(validateName: (name: string) => string | undefined): Asker {
  return {
    name: async () =>
      answered(
        await prompt.text({ message: 'Project name', validate: (v) => validateName(v ?? '') }),
      ),
    types: async () =>
      answered(
        await prompt.multiselect<AppType>({
          message: 'What does the project have?',
          options: TYPES.map((type) => ({ value: type, label: type })),
          required: true,
        }),
      ),
    architecture: async () =>
      answered(
        await prompt.select<Answers['architecture']>({
          message: 'One project, or a workspace ready to grow?',
          options: [
            { value: 'alone', label: 'alone' },
            { value: 'monorepo', label: 'monorepo' },
          ],
          initialValue: 'alone',
        }),
      ),
    multiTenant: async () =>
      answered(await prompt.confirm({ message: 'Is it multi-tenant?', initialValue: false })),
    mcp: async () =>
      answered(
        await prompt.confirm({
          message: 'Let AI assistants use the API through MCP, signed in as the user?',
          initialValue: false,
        }),
      ),
    email: async () =>
      answered(
        await prompt.confirm({
          message: 'Verify emails and let users reset their password?',
          initialValue: false,
        }),
      ),
    social: async () =>
      answered(
        await prompt.multiselect<SocialProvider>({
          message: 'Social sign-in? Leave all unselected for none',
          options: SOCIAL_PROVIDERS.map((provider) => ({
            value: provider,
            label: provider === 'google' ? 'Google' : 'Apple',
          })),
          required: false,
        }),
      ),
  }
}
