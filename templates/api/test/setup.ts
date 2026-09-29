// tsyringe reads decorator metadata as each class is loaded, so this must come before any other import.
import 'reflect-metadata'
import { MikroORM } from '@mikro-orm/postgresql'
import { getMigrations } from 'better-auth/db/migration'
import { Client, type Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, inject } from 'vitest'
import { createAuth } from '../src/infra/auth/auth.factory'
import type { Env } from '../src/infra/config/env'
import { createOrmConfig } from '../src/infra/database/mikroorm/mikro-orm.factory'

let orm: MikroORM
let databaseUrl: string
let tables: string[] = []

export function testOrm(): MikroORM {
  return orm
}

export function testDatabaseUrl(): string {
  return databaseUrl
}

export function testEnv(): Env {
  return {
    NODE_ENV: 'test',
    PORT: 3000,
    DATABASE_URL: databaseUrl,
    AUTH_DATABASE_URL: databaseUrl,
    BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters',
    BETTER_AUTH_URL: 'http://localhost:3000',
    WEB_ORIGIN: 'http://localhost:5173',
    LOG_LEVEL: 'error',
  }
}

async function createWorkerDatabase(baseUrl: string, name: string): Promise<string> {
  const admin = new Client({ connectionString: baseUrl })

  await admin.connect()
  await admin.query(`DROP DATABASE IF EXISTS "${name}"`)
  await admin.query(`CREATE DATABASE "${name}"`)
  await admin.end()

  const url = new URL(baseUrl)
  url.pathname = `/${name}`

  const worker = new Client({ connectionString: url.toString() })

  await worker.connect()
  await worker.query('CREATE SCHEMA IF NOT EXISTS auth')
  await worker.end()

  return url.toString()
}

async function migrateAuth(): Promise<void> {
  const auth = createAuth(testEnv())
  const { runMigrations } = await getMigrations(auth.options)

  await runMigrations()
  await (auth.options.database as Pool).end()
}

beforeAll(async () => {
  const name = `test_${process.env.VITEST_WORKER_ID ?? '1'}`

  databaseUrl = await createWorkerDatabase(inject('postgresUrl'), name)
  await migrateAuth()

  orm = await MikroORM.init(createOrmConfig(testEnv()))

  await orm.migrator.up()

  const metadata = orm.getMetadata().getAll()
  const own = Object.values(metadata)
    .filter(
      (meta) => meta.tableName !== undefined && meta.pivotTable !== true && meta.schema !== 'auth',
    )
    .map((meta) => `"${meta.tableName}"`)

  tables = [...own, 'auth."user"', 'auth.session', 'auth.account', 'auth.verification']
})

beforeEach(async () => {
  if (tables.length > 0) {
    await orm.em.getConnection().execute(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`)
  }
})

afterAll(async () => {
  await orm.close()
})
