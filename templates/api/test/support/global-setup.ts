import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import type { TestProject } from 'vitest/node'

let container: StartedPostgreSqlContainer | undefined

export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer('postgres:18-alpine').start()

  project.provide('postgresUrl', container.getConnectionUri())
}

// Vitest still tears down when setup threw, as when the image could not be pulled; there is no container then, and
// failing here would print a second error over the one that matters.
export async function teardown(): Promise<void> {
  await container?.stop()
}

declare module 'vitest' {
  interface ProvidedContext {
    postgresUrl: string
  }
}
