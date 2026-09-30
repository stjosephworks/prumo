import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import type { TestProject } from 'vitest/node'

let container: StartedPostgreSqlContainer

export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer('postgres:18-alpine').start()

  project.provide('postgresUrl', container.getConnectionUri())
}

export async function teardown(): Promise<void> {
  await container.stop()
}

declare module 'vitest' {
  interface ProvidedContext {
    postgresUrl: string
  }
}
