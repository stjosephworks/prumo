import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type AppType, composeWorkspace, copyTemplate } from './compose.ts'
import { type Answers, writeContext } from './context.ts'
import { setJsonc } from './jsonc.ts'
import { applyMcp } from './mcp.ts'
import { schemeFor } from './names.ts'
import { CliError } from './output.ts'

async function rewrite(path: string, change: (text: string) => string): Promise<void> {
  await writeFile(path, change(await readFile(path, 'utf8')))
}

async function nameProject(root: string, name: string): Promise<void> {
  await rewrite(join(root, 'package.json'), (text) => setJsonc(text, ['name'], name))
  await rewrite(join(root, 'README.md'), (text) => text.replace(/^# .*$/m, `# ${name}`))
}

async function nameMobileApp(app: string, name: string): Promise<void> {
  await rewrite(join(app, 'app.json'), (text) => {
    let result = setJsonc(text, ['expo', 'name'], name)
    result = setJsonc(result, ['expo', 'slug'], name)
    return setJsonc(result, ['expo', 'scheme'], schemeFor(name))
  })
}

const SECRET_LINE = /^BETTER_AUTH_SECRET=.*$/m

// `.env` stays out of git, so the example is the committed truth and a fresh project gets a copy it can start with.
// Only the secret differs: a sample value is public, so every generated API draws its own.
async function writeLocalEnv(app: string, type: AppType): Promise<void> {
  const example = join(app, '.env.example')

  if (!existsSync(example)) {
    return
  }

  let env = await readFile(example, 'utf8')

  if (type === 'api') {
    if (!SECRET_LINE.test(env)) {
      throw new Error(`${example} no longer carries a BETTER_AUTH_SECRET line`)
    }
    env = env.replace(SECRET_LINE, `BETTER_AUTH_SECRET=${randomBytes(32).toString('base64url')}`)
  }

  await writeFile(join(app, '.env'), env)
}

export type ChildOutput = 'inherit' | 'stderr'

// Compose names the container and volume after the project; without this, every workspace's apps/api is `api`
// and a second project's database replaces the first's.
async function nameCompose(api: string, name: string): Promise<void> {
  await rewrite(join(api, 'docker-compose.yml'), (text) => {
    if (!/^name: .*$/m.test(text)) {
      throw new Error(`${join(api, 'docker-compose.yml')} no longer carries a top-level name`)
    }
    return text.replace(/^name: .*$/m, `name: ${name}`)
  })
}

function run(command: string, args: string[], cwd: string, output: ChildOutput): void {
  // Under --json stdout belongs to the result document, so a child's output goes to stderr instead.
  const result = spawnSync(command, args, {
    cwd,
    stdio: output === 'inherit' ? 'inherit' : ['ignore', 2, 2],
  })

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed in ${cwd}`)
  }
}

export async function generate({
  templates,
  knowledge,
  target,
  answers,
  install,
  childOutput = 'inherit',
}: {
  templates: string
  knowledge: string
  target: string
  answers: Answers
  install: boolean
  childOutput?: ChildOutput
}): Promise<void> {
  if (existsSync(target) && (await readdir(target)).length > 0) {
    throw new CliError('target_not_empty', `${target} already exists and is not empty.`)
  }

  const [only] = answers.types

  if (answers.architecture === 'alone' && only !== undefined) {
    await copyTemplate(join(templates, only), target)
    await applyMcp(target, only, answers.mcp)
    await nameProject(target, answers.name)
    await writeLocalEnv(target, only)

    if (only === 'api') {
      await nameCompose(target, answers.name)
    }

    if (only === 'mobile') {
      await nameMobileApp(target, answers.name)
    }
  } else {
    await composeWorkspace({
      templates,
      target,
      types: answers.types,
      mobileScheme: schemeFor(answers.name),
      mcp: answers.mcp,
    })
    await nameProject(target, answers.name)

    for (const type of answers.types) {
      await writeLocalEnv(join(target, 'apps', type), type)
    }

    if (answers.types.includes('api')) {
      await nameCompose(join(target, 'apps', 'api'), answers.name)
    }

    if (answers.types.includes('mobile')) {
      await nameMobileApp(join(target, 'apps', 'mobile'), answers.name)
    }
  }

  await writeContext(knowledge, target, answers)

  run('git', ['init', '--quiet'], target, childOutput)

  if (install) {
    run('pnpm', ['install'], target, childOutput)
    // Rewriting the contract import changes import grouping and line length; only the formatter can settle both.
    run('pnpm', ['exec', 'biome', 'check', '--write'], target, childOutput)

    // The route tree is generated from the route files, and cutting MCP removed one.
    if (answers.types.includes('web')) {
      const web = answers.architecture === 'alone' ? target : join(target, 'apps', 'web')
      run('pnpm', ['exec', 'tsr', 'generate'], web, childOutput)
    }
  }
}
