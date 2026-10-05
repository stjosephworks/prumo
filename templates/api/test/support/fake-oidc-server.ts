import { createHash } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'

type Grant = { nonce: string; challenge: string | null; claims: Record<string, unknown> }

// A minimal OpenID Connect provider on localhost: discovery, keys, and a token endpoint that signs an ID token for
// the code it handed out. Enough to run the real adapter end to end, which no test can do against Google or Apple.
export async function fakeOidcServer({ pkce }: { pkce: boolean }) {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' }
  const grants = new Map<string, Grant>()
  const tokenRequests: URLSearchParams[] = []
  let issuer = ''

  const server: Server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', issuer)
    const json = (status: number, body: unknown) => {
      response.writeHead(status, { 'content-type': 'application/json' })
      response.end(JSON.stringify(body))
    }

    if (url.pathname === '/.well-known/openid-configuration') {
      return json(200, {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        token_endpoint_auth_methods_supported: ['client_secret_post'],
        ...(pkce && { code_challenge_methods_supported: ['S256'] }),
      })
    }

    if (url.pathname === '/jwks') {
      return json(200, { keys: [jwk] })
    }

    if (url.pathname === '/token') {
      let body = ''
      for await (const chunk of request) body += chunk
      const form = new URLSearchParams(body)
      tokenRequests.push(form)

      const grant = grants.get(form.get('code') ?? '')
      const verifier = form.get('code_verifier')

      if (
        grant === undefined ||
        (grant.challenge !== null &&
          createHash('sha256')
            .update(verifier ?? '')
            .digest('base64url') !== grant.challenge)
      ) {
        return json(400, { error: 'invalid_grant' })
      }

      grants.delete(form.get('code') ?? '')

      const idToken = await new SignJWT({ nonce: grant.nonce, ...grant.claims })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setIssuer(issuer)
        .setAudience(form.get('client_id') ?? '')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey)

      return json(200, { access_token: 'access', token_type: 'Bearer', id_token: idToken })
    }

    json(404, {})
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  issuer = `http://127.0.0.1:${(server.address() as { port: number }).port}`

  return {
    issuer: new URL(issuer),
    tokenRequests,
    // What the provider would do after the user signs in: remember the request and hand back a code.
    authorize(authorizationUrl: string, claims: Record<string, unknown>): string {
      const params = new URL(authorizationUrl).searchParams
      const code = crypto.randomUUID()

      grants.set(code, {
        nonce: params.get('nonce') ?? '',
        challenge: params.get('code_challenge'),
        claims,
      })
      return code
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
