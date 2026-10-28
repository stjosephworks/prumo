import { describe, expect, it } from 'vitest'
import { validate } from '@/infra/config/env'

const RAW = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgres://app:app@localhost:5432/app',
  JWT_SECRET: 'test-secret-that-is-at-least-32-characters',
  API_URL: 'http://localhost:3000',
  LOG_LEVEL: 'error',
  SMS_COUNTRIES: 'US', // prumo:phone-code
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

describe('SESSION_LIFETIME_DAYS', () => {
  const env = { ...RAW, WEB_ORIGIN: 'http://localhost:5173' }

  it('is thirty days unless set, and a whole number of days from 1 to 365', () => {
    expect(validate(env).SESSION_LIFETIME_DAYS).toBe(30)
    expect(validate({ ...env, SESSION_LIFETIME_DAYS: '7' }).SESSION_LIFETIME_DAYS).toBe(7)
    expect(() => validate({ ...env, SESSION_LIFETIME_DAYS: '0' })).toThrow('SESSION_LIFETIME_DAYS')
    expect(() => validate({ ...env, SESSION_LIFETIME_DAYS: '1.5' })).toThrow(
      'SESSION_LIFETIME_DAYS',
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

// prumo:phone-code
describe('SMS_COUNTRIES', () => {
  const env = { ...RAW, WEB_ORIGIN: 'http://localhost:5173' }

  it('holds the countries a text may go to, as ISO 3166 codes', () => {
    expect(validate({ ...env, SMS_COUNTRIES: 'br, US' }).SMS_COUNTRIES).toEqual(['BR', 'US'])
  })

  it('is required, and refuses what is no country code', () => {
    const { SMS_COUNTRIES: _, ...without } = env

    expect(() => validate(without)).toThrow('SMS_COUNTRIES')
    expect(() => validate({ ...env, SMS_COUNTRIES: 'Brazil' })).toThrow('SMS_COUNTRIES')
  })
})
// prumo:end-phone-code

// prumo:code-sign-in
describe('REVIEW_SIGN_IN', () => {
  const env = { ...RAW, WEB_ORIGIN: 'http://localhost:5173' }

  it('names nobody when unset, and reads destination:code pairs, a phone included', () => {
    expect(validate(env).REVIEW_SIGN_IN.size).toBe(0)
    expect(
      validate({ ...env, REVIEW_SIGN_IN: 'Review@Example.com:424242, +14155550100:135790' })
        .REVIEW_SIGN_IN,
    ).toEqual(
      new Map([
        ['review@example.com', '424242'],
        ['+14155550100', '135790'],
      ]),
    )
  })

  it('refuses a code that is not six digits', () => {
    expect(() => validate({ ...env, REVIEW_SIGN_IN: 'review@example.com:1234' })).toThrow(
      'REVIEW_SIGN_IN',
    )
  })
})
// prumo:end-code-sign-in
