import * as prompt from '@clack/prompts'
import { type App, appNameProblem, REPEATABLE } from './apps.ts'
import type { AppType } from './compose.ts'
import type { Answers } from './context.ts'
import { SOCIAL_PROVIDERS, type SocialProvider } from './features.ts'

export type Asker = {
  name: () => Promise<string>
  types: () => Promise<AppType[]>
  architecture: () => Promise<Answers['architecture']>
  apps: (defaults: App[], project: string) => Promise<App[]>
  multiTenant: () => Promise<boolean>
  mcp: () => Promise<boolean>
  email: () => Promise<boolean>
  social: () => Promise<SocialProvider[]>
}

const TYPES: AppType[] = ['api', 'web', 'mobile', 'site']

const DONE = 'done'

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
    apps: async (defaults, project) => {
      const advanced = answered(
        await prompt.confirm({
          message: 'Advanced: rename the apps, or add another web or site?',
          initialValue: false,
        }),
      )

      if (!advanced) {
        return defaults
      }

      const apps: App[] = []
      const named = async (type: AppType, initialValue: string) => {
        const name = answered(
          await prompt.text({
            message: `Name of the ${type} app`,
            initialValue,
            validate: (value) => appNameProblem(value ?? '', apps, project),
          }),
        )

        apps.push({ name, type })
      }

      for (const app of defaults) {
        await named(app.type, app.name)
      }

      while (true) {
        const type = answered(
          await prompt.select<AppType | typeof DONE>({
            message: 'Add another app?',
            options: [
              { value: DONE, label: 'no, that is all' },
              ...REPEATABLE.map((each) => ({ value: each, label: each })),
            ],
            initialValue: DONE,
          }),
        )

        if (type === DONE) {
          return apps
        }

        await named(type, '')
      }
    },
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
