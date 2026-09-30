import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { testEnv, testOrm } from '@test/support/setup'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mcpResource } from '@/infra/auth/auth.factory'
import { createContainer } from '@/infra/di'
import { buildApp } from '@/infra/http/app'

const ORIGIN = 'http://localhost:5173'
// A web client needs an https redirect off loopback; the test never follows it.
const REDIRECT = 'https://client.example.com/callback'

let app: FastifyInstance
let env: ReturnType<typeof testEnv>

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number }
      server.close(() => resolve(port))
    })
  })
}

// requireMcpAuth fetches the JWKS from BETTER_AUTH_URL, so the application listens for real.
beforeEach(async () => {
  const port = await freePort()
  env = { ...testEnv(), BETTER_AUTH_URL: `http://127.0.0.1:${port}` }
  app = await buildApp(createContainer({ env, orm: testOrm() }))
  await app.listen({ port, host: '127.0.0.1' })
})

afterEach(async () => {
  await app.close()
})

async function signUp(): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: { origin: ORIGIN },
    payload: {
      name: 'Ana',
      email: `${crypto.randomUUID()}@example.com`,
      password: 'correct-horse-battery',
    },
  })
  const cookies = [response.headers['set-cookie']].flat().filter((c) => c !== undefined)

  return cookies.map((cookie) => cookie.split(';')[0]).join('; ')
}

// The path an MCP client takes: register, authorize with PKCE, consent, exchange the code.
async function accessToken(cookie: string): Promise<string> {
  const client = await app.inject({
    method: 'POST',
    url: '/api/auth/oauth2/create-client',
    headers: { cookie, origin: ORIGIN },
    payload: { redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none' },
  })
  const clientId = client.json().client_id as string
  const verifier = randomBytes(32).toString('base64url')
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT,
    scope: 'openid',
    state: 'state',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    resource: mcpResource(env),
  })
  const authorize = await app.inject({
    url: `/api/auth/oauth2/authorize?${query}`,
    headers: { cookie },
  })
  const consentPage = new URL(authorize.headers.location as string)
  const consent = await app.inject({
    method: 'POST',
    url: '/api/auth/oauth2/consent',
    headers: { cookie, origin: ORIGIN },
    payload: { accept: true, oauth_query: consentPage.search.slice(1) },
  })
  const redirect = new URL(consent.json().url ?? consent.json().redirect_uri)
  const token = await app.inject({
    method: 'POST',
    url: '/api/auth/oauth2/token',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({
      grant_type: 'authorization_code',
      code: redirect.searchParams.get('code') ?? '',
      redirect_uri: REDIRECT,
      client_id: clientId,
      code_verifier: verifier,
      resource: mcpResource(env),
    }).toString(),
  })

  return token.json().access_token as string
}

// The SDK's own client, speaking the real protocol over HTTP.
async function connect(token: string): Promise<Client> {
  // The server rejects 2025-era traffic, as Better Auth's MCP profile asks.
  const client = new Client(
    { name: 'test', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  )

  await client.connect(
    new StreamableHTTPClientTransport(new URL(mcpResource(env)), {
      requestInit: { headers: { authorization: `Bearer ${token}` } },
    }),
  )
  return client
}

describe('mcp controller', () => {
  it('tells an MCP client where to authorize', async () => {
    const metadata = await app.inject({ url: '/.well-known/oauth-protected-resource' })
    const refused = await app.inject({ method: 'POST', url: '/api/mcp', payload: {} })

    expect(metadata.json()).toMatchObject({ resource: mcpResource(env) })
    expect(refused.statusCode).toBe(401)
    expect(refused.headers['www-authenticate']).toContain('resource_metadata=')
  })

  it('runs a tool for the user who authorized the client, with public fields only', async () => {
    const client = await connect(await accessToken(await signUp()))
    const result = await client.callTool({ name: 'get_profile', arguments: {} })
    expect(Object.keys(result.structuredContent ?? {}).sort()).toEqual(
      ['createdAt', 'displayName', 'id', 'locale', 'timezone', 'updatedAt', 'userId'].sort(),
    )
    expect(result.structuredContent).toMatchObject({ displayName: 'Ana' })

    await client.close()
  })

  it('changes the profile through a tool', async () => {
    const client = await connect(await accessToken(await signUp()))
    const result = await client.callTool({
      name: 'update_profile',
      arguments: { timezone: 'America/Sao_Paulo' },
    })

    expect(result.structuredContent).toMatchObject({ timezone: 'America/Sao_Paulo' })

    await client.close()
  })
})
