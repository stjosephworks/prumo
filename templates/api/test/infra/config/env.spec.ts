import { describe, expect, it } from 'vitest'
import { validate } from '@/infra/config/env'

const RAW = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgres://app:app@localhost:5432/app',
  JWT_SECRET: 'test-secret-that-is-at-least-32-characters',
  API_URL: 'http://localhost:3000',
  LOG_LEVEL: 'error',
}

describe('WEB_ORIGIN', () => {
  it('holds every web app, comma-separated, written as a browser sends its origin', () => {
    const env = validate({ ...RAW, WEB_ORIGIN: 'http://localhost:5173, http://localhost:5174/' })

    expect(env.WEB_ORIGIN).toEqual(['http://localhost:5173', 'http://localhost:5174'])
  })

  it('refuses an empty list and an entry that is not a URL', () => {
    expect(() => validate({ ...RAW, WEB_ORIGIN: '' })).toThrow('WEB_ORIGIN')
    expect(() => validate({ ...RAW, WEB_ORIGIN: 'http://localhost:5173,backoffice' })).toThrow(
      'WEB_ORIGIN',
    )
  })
})

describe('TRUST_PROXY', () => {
  it('trusts nobody by default, so a client cannot choose the address the rate limits read', () => {
    expect(validate({ ...RAW, WEB_ORIGIN: 'http://localhost:5173' }).TRUST_PROXY).toBe(false)
  })

  it('takes true, or the proxies as IPs and CIDRs, comma-separated', () => {
    const env = { ...RAW, WEB_ORIGIN: 'http://localhost:5173' }

    expect(validate({ ...env, TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(true)
    expect(validate({ ...env, TRUST_PROXY: '10.0.0.0/8, 192.168.1.4' }).TRUST_PROXY).toEqual([
      '10.0.0.0/8',
      '192.168.1.4',
    ])
  })

  it('refuses a hop count, which Fastify no longer accepts, and anything that is not an address', () => {
    const env = { ...RAW, WEB_ORIGIN: 'http://localhost:5173' }

    expect(() => validate({ ...env, TRUST_PROXY: '1' })).toThrow('TRUST_PROXY')
    expect(() => validate({ ...env, TRUST_PROXY: 'load-balancer' })).toThrow('TRUST_PROXY')
  })
})
