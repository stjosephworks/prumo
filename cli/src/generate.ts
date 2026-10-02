import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type AppType, composeWorkspace, copyTemplate } from './compose.ts'
import { type Answers, writeContext } from './context.ts'
import { SHELL } from './doctor.ts'
import { applyFeatures, enabledFor } from './features.ts'
import { setJsonc } from './jsonc.ts'
import { schemeFor, targetProblem } from './names.ts'
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

const SECRET_LINE = /^JWT_SECRET=.*$/m

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
      throw new Error(`${example} no longer carries a JWT_SECRET line`)
    }
    env = env.replace(SECRET_LINE, `JWT_SECRET=${randomBytes(32).toString('base64url')}`)
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

// Ctrl+C reaches the child and Prumo alike. While a listener exists Prumo is not killed outright, so the run that
// was stopped returns, its failure removes the half-written project, and the next run starts from nothing.
let interrupted = false

function interrupt(): void {
  interrupted = true
}

function stopIfInterrupted(): void {
  if (interrupted) {
    throw new CliError('interrupted', 'Interrupted. Nothing was kept.')
  }
}

function run(command: string, args: string[], cwd: string, output: ChildOutput): void {
  stopIfInterrupted()

  // Under --json stdout belongs to the result document, so a child's output goes to stderr instead.
  const result = spawnSync(command, args, {
    cwd,
    stdio: output === 'inherit' ? 'inherit' : ['ignore', 2, 2],
    shell: SHELL,
  })

  // spawnSync holds the event loop, so the listener has not run yet; the child says it instead, either by dying of
  // the signal or, as pnpm does, by catching it and exiting with 130.
  if (result.signal === 'SIGINT' || result.status === 130) {
    interrupted = true
  }

  stopIfInterrupted()

  if (result.status !== 0) {
    const why =
      result.error?.message ??
      (result.signal !== null ? `stopped by ${result.signal}` : `exit code ${result.status}`)

    throw new Error(`${command} ${args.join(' ')} failed in ${cwd}: ${why}`)
  }
}

// Only what this run wrote goes: a directory it created, or the contents of the empty one it was given.
async function discard(target: string, created: boolean): Promise<void> {
  if (created) {
    await rm(target, { recursive: true, force: true })
    return
  }

  for (const entry of await readdir(target).catch(() => [])) {
    await rm(join(target, entry), { recursive: true, force: true })
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
  const occupied = targetProblem(target)

  if (occupied !== undefined) {
    throw new CliError('target_not_empty', occupied)
  }

  const created = !existsSync(target)

  interrupted = false
  process.on('SIGINT', interrupt)

  try {
    await write({ templates, knowledge, target, answers, install, childOutput })
  } catch (error: unknown) {
    await discard(target, created)
    throw error
  } finally {
    process.off('SIGINT', interrupt)
  }
}

async function write({
  templates,
  knowledge,
  target,
  answers,
  install,
  childOutput,
}: {
  templates: string
  knowledge: string
  target: string
  answers: Answers
  install: boolean
  childOutput: ChildOutput
}): Promise<void> {
  const [only] = answers.types

  if (answers.architecture === 'alone' && only !== undefined) {
    await copyTemplate(join(templates, only), target)
    await applyFeatures(target, only, enabledFor(answers))
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
      features: enabledFor(answers),
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
