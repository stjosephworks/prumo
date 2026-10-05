import type { FastifyReply, FastifyRequest } from 'fastify'
import type { TokensResponseDto } from '@/domain/auth/dto/tokens-response.dto'
import type { SessionTokens } from '@/domain/auth/use-cases/start-session.use-case'
import type { Env } from '@/infra/config/env'
import { ACCESS_COOKIE } from '@/infra/http/hooks/auth.hook'

export const REFRESH_COOKIE = 'refresh_token'

// The refresh cookie travels only to the one route that reads it, never with an ordinary request.
const REFRESH_PATH = '/api/auth/refresh'

// A native client asks for its tokens in the body. The web never does: a token JavaScript can read is a token an
// injected script can take.
export function wantsBearer(request: FastifyRequest): boolean {
  return request.headers['x-auth-transport'] === 'bearer'
}

function asBody(tokens: SessionTokens): TokensResponseDto {
  return {
    accessToken: tokens.accessToken.token,
    refreshToken: tokens.refreshToken,
    expiresIn: Math.round((tokens.accessToken.expiresAt.getTime() - Date.now()) / 1000),
  }
}

// How a started session reaches the client, wherever it was started: sign-in, a confirmed email, a provider.
export function sessionDelivery(env: Pick<Env, 'API_URL'>) {
  const cookie = {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.API_URL.startsWith('https://'),
  } as const

  function clearCookies(reply: FastifyReply): void {
    reply.clearCookie(ACCESS_COOKIE, { ...cookie, path: '/' })
    reply.clearCookie(REFRESH_COOKIE, { ...cookie, path: REFRESH_PATH })
  }

  function setCookies(reply: FastifyReply, tokens: SessionTokens): void {
    reply.setCookie(ACCESS_COOKIE, tokens.accessToken.token, {
      ...cookie,
      path: '/',
      expires: tokens.accessToken.expiresAt,
    })
    reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...cookie,
      path: REFRESH_PATH,
      expires: tokens.refreshExpiresAt,
    })
  }

  // The web gets cookies and an empty body; a native client gets the tokens and no cookie.
  function deliver(
    request: FastifyRequest,
    reply: FastifyReply,
    tokens: SessionTokens,
    status: 200 | 201,
  ) {
    if (wantsBearer(request)) {
      return reply.code(status).send(asBody(tokens))
    }

    setCookies(reply, tokens)

    return reply.code(status === 201 ? 201 : 204).send()
  }

  return { deliver, setCookies, clearCookies }
}
