import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { tokensResponseSchema } from '@/domain/auth/dto/tokens-response.dto'
import type { SocialClient } from '@/domain/auth/entities/social-sign-in.entity'
import { CompleteSocialSignInUseCase } from '@/domain/auth/use-cases/complete-social-sign-in.use-case'
import { ExchangeSocialCodeUseCase } from '@/domain/auth/use-cases/exchange-social-code.use-case'
import { StartSocialSignInUseCase } from '@/domain/auth/use-cases/start-social-sign-in.use-case'
import { DomainError } from '@/domain/shared/errors/domain-error'
import { ENV, type Env } from '@/infra/config/env'
import { ATTEMPTS } from '@/infra/http/controllers/auth.controller'
import { HttpError } from '@/infra/http/errors/http-error'
import { sessionDelivery } from '@/infra/http/session-delivery'

const BROWSER_COOKIE = 'social_sign_in'
const BROWSER_COOKIE_MAX_AGE_S = 10 * 60

const PROVIDERS = [
  'google', // prumo:google
  'apple', // prumo:apple
] as const

const providerParams = z.object({ provider: z.enum(PROVIDERS) })

// Only a path on the web app: an absolute URL here would turn sign-in into an open redirect.
function safePath(path: string | undefined): string {
  return path?.startsWith('/') && !path.startsWith('//') ? path : '/'
}

// Apple sends the name it shares once, as JSON beside the code.
function appleName(user: string | undefined): string | null {
  try {
    const name = (JSON.parse(user ?? '') as { name?: { firstName?: string; lastName?: string } })
      .name
    const full = [name?.firstName, name?.lastName].filter(Boolean).join(' ')

    return full === '' ? null : full
  } catch {
    return null
  }
}

export async function socialController(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const env = app.container.resolve<Env>(ENV)
  const { deliver, setCookies } = sessionDelivery(env)
  const cookie = {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.API_URL.startsWith('https://'),
    path: '/api/auth/social',
  } as const

  const back = (client: SocialClient, query: Record<string, string>) =>
    client === 'mobile'
      ? `${env.MOBILE_APP_SCHEME}://social?${new URLSearchParams(query)}`
      : `${env.WEB_ORIGIN}/sign-in?${new URLSearchParams(query)}`

  // Apple's answer is a form.
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_request, body, done) => done(null, Object.fromEntries(new URLSearchParams(body as string))),
  )

  app.get(
    '/:provider',
    {
      config: { public: true, ...ATTEMPTS },
      schema: {
        tags: ['auth'],
        params: providerParams,
        querystring: z.object({
          client: z.enum(['web', 'mobile']).default('web'),
          returnTo: z.string().max(512).optional(),
        }),
      },
    },
    async (request, reply) => {
      const { client, returnTo } = request.query

      if (client === 'mobile' && env.MOBILE_APP_SCHEME === undefined) {
        throw new HttpError(
          422,
          'MOBILE_APP_SCHEME is not set, so a mobile app cannot be sent back',
        )
      }

      const started = await app.container.resolve(StartSocialSignInUseCase).execute({
        provider: request.params.provider,
        client,
        returnTo: safePath(returnTo),
      })

      // The client rides beside the token, so an error found before the flow is read still goes to the right place.
      reply.setCookie(BROWSER_COOKIE, `${client}~${started.browserToken}`, {
        ...cookie,
        maxAge: BROWSER_COOKIE_MAX_AGE_S,
      })

      return reply.redirect(started.url)
    },
  )

  // A cross-site POST carries no SameSite=Lax cookie, and a top-level GET does: Apple's form is turned into a
  // redirect to the same address, so the browser's token comes with it.
  app.post(
    '/:provider/callback',
    { config: { public: true }, schema: { hide: true, params: providerParams } },
    async (request, reply) => {
      const form = new URLSearchParams(request.body as Record<string, string>)

      return reply
        .code(303)
        .redirect(`${env.API_URL}/api/auth/social/${request.params.provider}/callback?${form}`)
    },
  )

  app.get(
    '/:provider/callback',
    {
      config: { public: true },
      schema: {
        hide: true,
        params: providerParams,
        querystring: z.object({
          state: z.string().optional(),
          code: z.string().optional(),
          error: z.string().optional(),
          user: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const [client, browserToken] = (request.cookies[BROWSER_COOKIE] ?? 'web~').split('~') as [
        SocialClient,
        string,
      ]
      const { state, code, error } = request.query

      reply.clearCookie(BROWSER_COOKIE, cookie)

      if (error !== undefined || state === undefined || code === undefined) {
        return reply.redirect(back(client, { error: 'social_sign_in_failed' }))
      }

      try {
        const outcome = await app.container.resolve(CompleteSocialSignInUseCase).execute({
          provider: request.params.provider,
          state,
          browserToken: browserToken === '' ? undefined : browserToken,
          callbackUrl: new URL(request.url, env.API_URL),
          name: appleName(request.query.user),
        })

        if (outcome.client === 'mobile') {
          return reply.redirect(back('mobile', { code: outcome.code }))
        }

        setCookies(reply, outcome.tokens)

        return reply.redirect(`${env.WEB_ORIGIN}${outcome.returnTo}`)
      } catch (caught) {
        if (caught instanceof DomainError) {
          return reply.redirect(back(client, { error: caught.code ?? 'social_sign_in_failed' }))
        }

        throw caught
      }
    },
  )

  // The mobile app trades the code it was sent back with for its tokens, once.
  app.post(
    '/exchange',
    {
      config: { public: true, ...ATTEMPTS },
      schema: {
        tags: ['auth'],
        body: z.strictObject({ code: z.string().min(1).max(512) }),
        response: { 200: tokensResponseSchema },
      },
    },
    async (request, reply) =>
      deliver(
        request,
        reply,
        await app.container.resolve(ExchangeSocialCodeUseCase).execute(request.body.code),
        200,
      ),
  )
}
