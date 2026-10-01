#!/usr/bin/env node
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import * as prompt from '@clack/prompts'
import { terminalAsker } from './asker.ts'
import { assetsFor, requireAssets } from './assets.ts'
import { cleanText, planClean } from './clean.ts'
import { COMMANDS, findCommand, helpText } from './commands.ts'
import { runDatabase } from './database.ts'
import { doctor, doctorText } from './doctor.ts'
import { generate } from './generate.ts'
import { validateProjectName } from './names.ts'
import { CliError, errorEnvelope, writeEnvelope } from './output.ts'
import { resolveAnswers } from './questions.ts'
import { cliVersion } from './version.ts'

type Result = { data: unknown; text: string; exitCode?: number }

function help(name: string | undefined): Result {
  if (name === undefined) {
    return { data: { commands: COMMANDS }, text: helpText() }
  }

  const command = findCommand(name)

  if (command === undefined) {
    throw new CliError('unknown_command', `Unknown command "${name}". Run \`prumo help\`.`)
  }

  return { data: { commands: [command] }, text: helpText(command) }
}

async function runNew(args: string[], json: boolean): Promise<Result> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      types: { type: 'string' },
      alone: { type: 'boolean', default: false },
      monorepo: { type: 'boolean', default: false },
      'multi-tenant': { type: 'boolean', default: false },
      'single-tenant': { type: 'boolean', default: false },
      mcp: { type: 'boolean', default: false },
      'no-mcp': { type: 'boolean', default: false },
      'skip-install': { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
    },
  })

  const [name, ...extra] = positionals

  if (extra.length > 0) {
    throw new CliError('usage', `Unexpected argument: ${extra.join(' ')}`)
  }

  const interactive = !json && process.stdin.isTTY === true && process.stdout.isTTY === true
  const answers = await resolveAnswers(
    {
      name,
      types: values.types,
      alone: values.alone,
      monorepo: values.monorepo,
      multiTenant: values['multi-tenant'],
      singleTenant: values['single-tenant'],
      mcp: values.mcp,
      noMcp: values['no-mcp'],
    },
    interactive ? terminalAsker(validateProjectName) : undefined,
  )

  if (!json && answers.types.length > 1) {
    prompt.log.info(
      `${answers.types.length} types make a workspace: apps/ and packages/ under one root.`,
    )
  }

  const target = resolve(answers.name)
  const install = !values['skip-install']

  await generate({
    ...requireAssets(assetsFor(import.meta.dirname)),
    target,
    answers,
    install,
    childOutput: json ? 'stderr' : 'inherit',
  })

  if (!json) {
    prompt.outro(`Created ${answers.name}.`)
  }

  return { data: { ...answers, target, installed: install }, text: '' }
}

async function runClean(args: string[], json: boolean): Promise<Result> {
  const { values } = parseArgs({
    args,
    options: {
      'dry-run': { type: 'boolean', default: false },
      yes: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
    },
  })

  const plan = await planClean({
    cwd: process.cwd(),
    templates: requireAssets(assetsFor(import.meta.dirname)).templates,
    force: values.force,
  })
  const pending = plan.items.some((item) => item.status === 'pending')
  const result = (applied: boolean): Result => ({
    data: { root: plan.root, dryRun: values['dry-run'], applied, items: plan.items },
    text: cleanText(plan.items),
  })

  if (!pending || values['dry-run']) {
    return result(false)
  }

  if (!values.yes) {
    const interactive = !json && process.stdin.isTTY === true && process.stdout.isTTY === true

    if (!interactive) {
      throw new CliError('needs_input', 'Outside an interactive terminal, pass --yes to clean.')
    }

    console.log(cleanText(plan.items))
    const confirmed = await prompt.confirm({ message: 'Remove these?', initialValue: false })

    if (prompt.isCancel(confirmed) || !confirmed) {
      throw new CliError('declined', 'Nothing was removed.')
    }
  }

  await plan.apply()
  return result(true)
}

async function main(argv: string[]): Promise<void> {
  const json = argv.includes('--json')
  const index = argv.findIndex((arg) => !arg.startsWith('-'))
  const command = index === -1 ? undefined : argv[index]
  const args = index === -1 ? [] : argv.slice(index + 1)
  const wantsHelp = argv.includes('--help') || argv.includes('-h')
  const name = command ?? (argv.includes('--version') || argv.includes('-v') ? 'version' : 'help')

  try {
    let result: Result

    if (wantsHelp && command !== undefined && command !== 'help') {
      result = help(command)
    } else if (name === 'help') {
      const [topic] = args.filter((arg) => !arg.startsWith('-'))
      result = help(topic)
    } else if (name === 'version') {
      const current = cliVersion()
      result = { data: { version: current }, text: current }
    } else if (name === 'doctor') {
      const report = await doctor()
      if (!report.ready) {
        throw new CliError('not_ready', 'This machine is missing something Prumo needs.', report)
      }
      result = { data: report, text: doctorText(report) }
    } else if (name === 'db') {
      // The script writes its own output, --json included.
      process.exitCode = runDatabase(args, process.cwd())
      return
    } else if (name === 'clean') {
      result = await runClean(args, json)
    } else if (name === 'new') {
      result = await runNew(args, json)
    } else {
      throw new CliError('unknown_command', `Unknown command "${name}". Run \`prumo help\`.`)
    }

    if (json) {
      writeEnvelope({ ok: true, command: name, data: result.data })
    } else if (result.text !== '') {
      console.log(result.text)
    }
  } catch (error: unknown) {
    const envelope = errorEnvelope(name, error)

    if (json) {
      writeEnvelope(envelope)
    } else if (error instanceof CliError && error.code === 'not_ready') {
      console.error(doctorText(error.data as Parameters<typeof doctorText>[0]))
    } else {
      console.error(envelope.ok ? '' : envelope.error.message)
    }

    process.exitCode = 1
  }
}

await main(process.argv.slice(2))
