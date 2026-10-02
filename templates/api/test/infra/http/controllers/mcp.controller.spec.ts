import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { testEnv } from '@test/support/setup'
import { cookieHeader, testApp } from '@test/support/test-app'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { InvalidClientError } from '@/domain/oauth/errors/invalid-client.error'
import { CLIENT_METADATA, type ClientMetadata } from '@/domain/oauth/ports/client-metadata.port'
import { mcpResource } from '@/infra/mcp/mcp.server'

const ORIGIN = 'http://localhost:5173'
const CLIENT_ID = 'https://client.example.com/oauth/client.json'
// A web client needs an https redirect off loopback; the test never follows it.
const REDIRECT = 'https://client.example.com/callback'

let app: FastifyInstance
let env: ReturnType<typeof testEnv>
let register: Awaited<ReturnType<typeof testApp>>['signUp']

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number }
      server.close(() => resolve(port))
    })
  })
}

// Stands in for the HTTPS fetch of the client's metadata document, which the adapter's own test covers.
const clients = {
  async read(clientId: string): Promise<ClientMetadata> {
    if (clientId !== CLIENT_ID) {
      throw new InvalidClientError('Unknown client')
    }

    return { clientId, clientName: 'Example Client', redirectUris: [REDIRECT] }
  },
}

// The SDK's client reaches the MCP route over real HTTP, so the application listens.
beforeEach(async () => {
  const port = await freePort()
  env = { ...testEnv(), API_URL: `http://127.0.0.1:${port}` }
  ;({ app, signUp: register } = await testApp({
    env,
    configure: (container) => container.register(CLIENT_METADATA, { useValue: clients }),
  }))
  await app.listen({ port, host: '127.0.0.1' })
})

afterEach(async () => {
  await app.close()
})

async function signUp(): Promise<string> {
  return cookieHeader((await register()).response)
}

function pkce() {
  const verifier = randomBytes(32).toString('base64url')

  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

function authorizeUrl(
  overrides: Record<string, string | undefined> = {},
  challenge = pkce().challenge,
) {
  const params = {
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    state: 'xyz',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource: mcpResource(env),
    ...overrides,
  }
  const query = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined),
  )

  return `/api/oauth/authorize?${query}`
}

function token(form: Record<string, string>) {
  return app.inject({
    method: 'POST',
    url: '/api/oauth/token',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams(form).toString(),
  })
}

// The path an MCP client takes: authorize with PKCE, the user consents on the web, the code becomes tokens.
async function authorize(cookie: string, accept = true) {
  const { verifier, challenge } = pkce()
  const started = await app.inject({ url: authorizeUrl({}, challenge) })
  const consent = new URL(started.headers.location as string)
  const id = consent.searchParams.get('request') ?? ''
  const view = await app.inject({ url: `/api/oauth/authorizations/${id}`, headers: { cookie } })
  const decision = await app.inject({
    method: 'POST',
    url: `/api/oauth/authorizations/${id}/decision`,
    headers: { cookie, origin: ORIGIN },
    payload: { accept },
  })

  return { started, consent, view, redirect: new URL(decision.json().redirectTo), verifier }
}

async function tokens(cookie: string) {
  const { redirect, verifier } = await authorize(cookie)
  const response = await token({
    grant_type: 'authorization_code',
    code: redirect.searchParams.get('code') ?? '',
    redirect_uri: REDIRECT,
    client_id: CLIENT_ID,
    code_verifier: verifier,
    resource: mcpResource(env),
  })

  return { response, code: redirect.searchParams.get('code') ?? '', verifier }
}

async function connect(accessToken: string): Promise<Client> {
  const client = new Client(
    { name: 'test', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  )

  await client.connect(
    new StreamableHTTPClientTransport(new URL(mcpResource(env)), {
      requestInit: { headers: { authorization: `Bearer ${accessToken}` } },
    }),
  )
  return client
}

describe('discovery', () => {
  it('tells an MCP client where to authorize, from the 401 to the server metadata', async () => {
    const refused = await app.inject({ method: 'POST', url: '/api/mcp', payload: {} })
    const challenge = refused.headers['www-authenticate'] as string
    const metadataUrl = /resource_metadata="([^"]+)"/.exec(challenge)?.[1] ?? ''
    const resource = await app.inject({ url: new URL(metadataUrl).pathname })
    const server = await app.inject({ url: '/.well-known/oauth-authorization-server' })

    expect(refused.statusCode).toBe(401)
    expect(resource.json()).toMatchObject({
      resource: mcpResource(env),
      authorization_servers: [env.API_URL],
    })
    expect(server.json()).toMatchObject({
      issuer: env.API_URL,
      code_challenge_methods_supported: ['S256'],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
    })
  })
})

describe('authorization', () => {
  it('sends the browser to consent, shows who asks and where the code goes, and returns it with iss', async () => {
    const { started, consent, view, redirect } = await authorize(await signUp())

    expect(started.statusCode).toBe(302)
    expect(`${consent.origin}${consent.pathname}`).toBe(`${ORIGIN}/consent`)
    expect(view.json()).toEqual({
      clientId: CLIENT_ID,
      clientName: 'Example Client',
      clientHost: 'client.example.com',
      redirectHost: 'client.example.com',
      redirectsToThisDevice: false,
    })
    expect(`${redirect.origin}${redirect.pathname}`).toBe(REDIRECT)
    expect(redirect.searchParams.get('state')).toBe('xyz')
    expect(redirect.searchParams.get('iss')).toBe(env.API_URL)
    expect(redirect.searchParams.get('code')).not.toBeNull()
  })

  it('answers a denial with access_denied', async () => {
    const { redirect } = await authorize(await signUp(), false)

    expect(redirect.searchParams.get('error')).toBe('access_denied')
    expect(redirect.searchParams.get('code')).toBeNull()
  })

  it('never redirects for an unknown client or an unregistered redirect URI', async () => {
    for (const overrides of [
      { client_id: 'https://evil.example.com/client.json' },
      { redirect_uri: 'https://evil.example.com/callback' },
    ]) {
      const response = await app.inject({ url: authorizeUrl(overrides) })

      expect(response.statusCode).toBe(422)
      expect(response.headers.location).toBeUndefined()
    }
  })

  it('sends a known client its error: no PKCE, plain PKCE, another resource', async () => {
    for (const [overrides, error] of [
      [{ code_challenge_method: undefined }, 'invalid_request'],
      [{ code_challenge_method: 'plain' }, 'invalid_request'],
      [{ resource: 'https://elsewhere.example.com/mcp' }, 'invalid_target'],
    ] as const) {
      const response = await app.inject({ url: authorizeUrl(overrides) })
      const location = new URL(response.headers.location as string)

      expect(location.searchParams.get('error')).toBe(error)
      expect(location.searchParams.get('state')).toBe('xyz')
      expect(location.searchParams.get('iss')).toBe(env.API_URL)
    }
  })
})

describe('token', () => {
  it('runs a tool for the user who authorized the client, with public fields only', async () => {
    const { response } = await tokens(await signUp())
    const client = await connect(response.json().access_token)
    const result = await client.callTool({ name: 'get_profile', arguments: {} })

    expect(response.headers['cache-control']).toBe('no-store')
    expect(Object.keys(result.structuredContent ?? {}).sort()).toEqual(
      ['createdAt', 'displayName', 'id', 'locale', 'timezone', 'updatedAt', 'userId'].sort(),
    )
    expect(result.structuredContent).toMatchObject({ displayName: 'Ana' })

    await client.close()
  })

  it('changes the profile through a tool', async () => {
    const { response } = await tokens(await signUp())
    const client = await connect(response.json().access_token)
    const result = await client.callTool({
      name: 'update_profile',
      arguments: { timezone: 'America/Sao_Paulo' },
    })

    expect(result.structuredContent).toMatchObject({ timezone: 'America/Sao_Paulo' })

    await client.close()
  })

  it('refuses a wrong verifier, and a code spent twice ends what the first use obtained', async () => {
    const cookie = await signUp()
    const { redirect } = await authorize(cookie)
    const wrong = await token({
      grant_type: 'authorization_code',
      code: redirect.searchParams.get('code') ?? '',
      redirect_uri: REDIRECT,
      client_id: CLIENT_ID,
      code_verifier: pkce().verifier,
    })

    expect(wrong.statusCode).toBe(400)
    expect(wrong.json().error).toBe('invalid_grant')

    const { response, code, verifier } = await tokens(cookie)
    const replay = await token({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    })
    const refresh = await token({
      grant_type: 'refresh_token',
      refresh_token: response.json().refresh_token,
      client_id: CLIENT_ID,
    })

    expect(replay.json().error).toBe('invalid_grant')
    expect(refresh.json().error).toBe('invalid_grant')
  })

  it('rotates the refresh token, and only for the client it was issued to', async () => {
    const { response } = await tokens(await signUp())
    const refreshToken = response.json().refresh_token
    const otherClient = await token({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: 'https://other.example.com/client.json',
    })
    const rotated = await token({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    })

    expect(otherClient.json().error).toBe('invalid_grant')
    expect(rotated.statusCode).toBe(200)
    expect(rotated.json().refresh_token).not.toBe(refreshToken)
  })

  it('keeps the MCP token and the application’s tokens apart', async () => {
    const cookie = await signUp()
    const { response } = await tokens(cookie)
    const access = cookie
      .split('; ')
      .find((pair) => pair.startsWith('access_token='))
      ?.slice(13)

    const mcpTokenOnApi = await app.inject({
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${response.json().access_token}` },
    })
    const apiTokenOnMcp = await app.inject({
      method: 'POST',
      url: '/api/mcp',
      headers: { authorization: `Bearer ${access}` },
      payload: {},
    })

    expect(mcpTokenOnApi.statusCode).toBe(401)
    expect(apiTokenOnMcp.statusCode).toBe(401)
    expect(apiTokenOnMcp.headers['www-authenticate']).toContain('error="invalid_token"')
  })
})
