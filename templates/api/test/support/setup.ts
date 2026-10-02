// tsyringe reads decorator metadata as each class is loaded, so this must come before any other import.
import 'reflect-metadata'
import { MikroORM } from '@mikro-orm/postgresql'
import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, inject } from 'vitest'
import type { Env } from '@/infra/config/env'
import { createOrmConfig } from '@/infra/database/mikroorm/mikro-orm.factory'

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
    JWT_SECRET: 'test-secret-that-is-at-least-32-characters',
    API_URL: 'http://localhost:3000',
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

  return url.toString()
}

beforeAll(async () => {
  const name = `test_${process.env.VITEST_WORKER_ID ?? '1'}`

  databaseUrl = await createWorkerDatabase(inject('postgresUrl'), name)

  orm = await MikroORM.init(createOrmConfig(testEnv()))

  await orm.migrator.up()

  // getAll() is a Map: Object.values() on it is empty, and nothing would be truncated.
  tables = [...orm.getMetadata().getAll().values()]
    .filter((meta) => meta.tableName !== undefined && meta.pivotTable !== true)
    .map((meta) => `"${meta.tableName}"`)
})

beforeEach(async () => {
  if (tables.length > 0) {
    await orm.em.getConnection().execute(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`)
  }
})

afterAll(async () => {
  await orm.close()
})
