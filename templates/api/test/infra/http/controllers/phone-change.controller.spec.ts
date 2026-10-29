import type { FakeTextMessages } from '@test/support/fakes/fake-text-messages'
import { testApp } from '@test/support/test-app'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

let app: FastifyInstance
let signIn: Awaited<ReturnType<typeof testApp>>['signIn']
let texts: FakeTextMessages

// A native client, so the access token travels in the header and nothing depends on cookies.
async function bearer(): Promise<Record<string, string>> {
  const { response } = await signIn({ bearer: true })

  return { authorization: `Bearer ${response.json().accessToken}` }
}

const post = (url: string, headers: Record<string, string>, payload: Record<string, string>) =>
  app.inject({ method: 'POST', url: `/api/v1/users/me${url}`, headers, payload })

beforeEach(async () => {
  ;({ app, signIn, texts } = await testApp())
})

afterEach(async () => {
  await app.close()
})

describe('changing the phone', () => {
  it('texts a code to the new number and takes it', async () => {
    const headers = await bearer()

    const sent = await post('/phone/code', headers, { phone: '+1 415 555 0199' })
    const changed = await post('/phone', headers, {
      phone: '+14155550199',
      code: texts.lastCode('+14155550199'),
    })

    expect(sent.statusCode).toBe(204)
    expect(changed.json().user.phone).toBe('+14155550199')
  })

  it("does not let one account spend another's code", async () => {
    const asking = await bearer()
    const other = await bearer()

    await post('/phone/code', asking, { phone: '+14155550198' })
    const stolen = await post('/phone', other, {
      phone: '+14155550198',
      code: texts.lastCode('+14155550198'),
    })

    expect(stolen.json()).toMatchObject({ code: 'invalid_code' })
  })
})
