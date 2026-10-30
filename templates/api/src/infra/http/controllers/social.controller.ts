import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { tokensResponseSchema } from '@/domain/auth/dto/tokens-response.dto'
import type { SocialClient } from '@/domain/auth/entities/social-sign-in.entity'
import { CompleteSocialSignInUseCase } from '@/domain/auth/use-cases/complete-social-sign-in.use-case'
import { DeleteAccountWithIdTokenUseCase } from '@/domain/auth/use-cases/delete-account-with-id-token.use-case' // prumo:apple
import { ExchangeSocialCodeUseCase } from '@/domain/auth/use-cases/exchange-social-code.use-case'
import { IssueNativeNonceUseCase } from '@/domain/auth/use-cases/issue-native-nonce.use-case' // prumo:apple
import { ResumeAccountDeletionUseCase } from '@/domain/auth/use-cases/resume-account-deletion.use-case' // prumo:apple
import { SignInWithIdTokenUseCase } from '@/domain/auth/use-cases/sign-in-with-id-token.use-case'
import { StartAccountDeletionUseCase } from '@/domain/auth/use-cases/start-account-deletion.use-case' // prumo:apple
import { StartSocialSignInUseCase } from '@/domain/auth/use-cases/start-social-sign-in.use-case'
import { DomainError } from '@/domain/shared/errors/domain-error'
import { ENV, type Env } from '@/infra/config/env'
import { ATTEMPTS } from '@/infra/http/controllers/auth.controller'
import { HttpError } from '@/infra/http/errors/http-error'
import { currentUser } from '@/infra/http/hooks/auth.hook' // prumo:apple
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

  // A web app is sent back to itself, so only an origin this API trusts is ever a destination.
  const trusted = (origin: string | undefined) =>
    origin !== undefined && env.WEB_ORIGIN.includes(origin) ? origin : env.WEB_ORIGIN[0]

  const back = (client: SocialClient, origin: string, query: Record<string, string>) =>
    client === 'mobile'
      ? `${env.MOBILE_APP_SCHEME}://social?${new URLSearchParams(query)}`
      : `${origin}/sign-in?${new URLSearchParams(query)}`

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
          // The web app that started, when there are several; one the API does not trust is refused.
          origin: z.string().max(512).optional(),
        }),
      },
    },
    async (request, reply) => {
      const { client, returnTo, origin: requested } = request.query

      if (requested !== undefined && !env.WEB_ORIGIN.includes(requested)) {
        throw new HttpError(422, 'origin is not one of the web apps this API trusts')
      }

      const origin = client === 'web' ? trusted(requested) : ''

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

      // The client and its origin ride beside the token, so an error found before the flow is read still goes to the
      // right place.
      reply.setCookie(BROWSER_COOKIE, `${client}~${origin}~${started.browserToken}`, {
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
      const [client, written, browserToken] = (request.cookies[BROWSER_COOKIE] ?? 'web~~').split(
        '~',
      ) as [SocialClient, string | undefined, string | undefined]
      // Read back through the list, so a cookie edited by hand cannot name a destination of its own.
      const origin = trusted(written)
      const { state, code, error } = request.query

      reply.clearCookie(BROWSER_COOKIE, cookie)

      if (error !== undefined || state === undefined || code === undefined) {
        return reply.redirect(back(client, origin, { error: 'social_sign_in_failed' }))
      }

      try {
        const outcome = await app.container.resolve(CompleteSocialSignInUseCase).execute({
          provider: request.params.provider,
          state,
          browserToken: browserToken === '' ? undefined : browserToken,
          callbackUrl: new URL(request.url, env.API_URL),
          name: appleName(request.query.user),
          locale: request.locale,
        })

        // prumo:apple
        if ('deleted' in outcome) {
          return reply.redirect(back(outcome.client, origin, { deleted: '1' }))
        }

        // prumo:end-apple
        if (outcome.client === 'mobile') {
          return reply.redirect(back('mobile', origin, { code: outcome.code }))
        }

        setCookies(reply, outcome.tokens)

        return reply.redirect(`${origin}${outcome.returnTo}`)
      } catch (caught) {
        if (caught instanceof DomainError) {
          return reply.redirect(
            back(client, origin, { error: caught.code ?? 'social_sign_in_failed' }),
          )
        }

        throw caught
      }
    },
  )

  // prumo:apple
  // Deleting an account that signs in with Apple goes through Apple once more, which revokes its authorization. The
  // signed-in client asks for a link, and opens it in a browser, where the trip starts.
  app.post(
    '/apple/deletion',
    {
      config: ATTEMPTS,
      schema: {
        tags: ['auth'],
        body: z.strictObject({
          client: z.enum(['web', 'mobile']),
          origin: z.string().max(512).optional(),
        }),
        response: { 200: z.object({ url: z.string() }) },
      },
    },
    async (request) => {
      const { client, origin } = request.body

      if (origin !== undefined && !env.WEB_ORIGIN.includes(origin)) {
        throw new HttpError(422, 'origin is not one of the web apps this API trusts')
      }

      const ticket = await app.container
        .resolve(StartAccountDeletionUseCase)
        .execute({ userId: currentUser(request).id, client })
      const query = new URLSearchParams({ ticket, client, ...(origin !== undefined && { origin }) })

      return { url: `${env.API_URL}/api/auth/social/apple/deletion?${query}` }
    },
  )

  app.get(
    '/apple/deletion',
    {
      config: { public: true, ...ATTEMPTS },
      schema: {
        hide: true,
        querystring: z.object({
          ticket: z.string().max(512),
          client: z.enum(['web', 'mobile']).default('web'),
          origin: z.string().max(512).optional(),
        }),
      },
    },
    async (request, reply) => {
      const { ticket, client } = request.query
      const origin = client === 'web' ? trusted(request.query.origin) : ''

      try {
        const url = await app.container.resolve(ResumeAccountDeletionUseCase).execute(ticket)

        // The ticket is the browser's token: the callback finds the trip by it, as by a sign-in's.
        reply.setCookie(BROWSER_COOKIE, `${client}~${origin}~${ticket}`, {
          ...cookie,
          maxAge: BROWSER_COOKIE_MAX_AGE_S,
        })

        return reply.redirect(url)
      } catch (caught) {
        if (caught instanceof DomainError) {
          return reply.redirect(back(client, origin, { error: 'social_sign_in_failed' }))
        }

        throw caught
      }
    },
  )
  // prumo:end-apple

  // prumo:apple
  // A nonce for Apple's own sheet in the app, and the trip to send back with the token it writes the nonce into.
  app.post(
    '/apple/nonce',
    {
      config: { public: true, ...ATTEMPTS },
      schema: {
        tags: ['auth'],
        response: { 200: z.object({ trip: z.string(), nonce: z.string() }) },
      },
    },
    async () => app.container.resolve(IssueNativeNonceUseCase).execute({ provider: 'apple' }),
  )

  // Deleting the account from the app: the nonce binds Apple's sheet to the signed-in account, and the sheet's token
  // and code come back to revoke and delete.
  app.post(
    '/apple/deletion/nonce',
    {
      config: ATTEMPTS,
      schema: {
        tags: ['auth'],
        response: { 200: z.object({ trip: z.string(), nonce: z.string() }) },
      },
    },
    async (request) =>
      app.container
        .resolve(IssueNativeNonceUseCase)
        .execute({ provider: 'apple', userId: currentUser(request).id }),
  )

  app.post(
    '/apple/deletion/token',
    {
      config: ATTEMPTS,
      schema: {
        tags: ['auth'],
        body: z.strictObject({
          trip: z.string().min(1).max(512),
          idToken: z.string().min(1).max(8192),
          code: z.string().min(1).max(512),
        }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await app.container
        .resolve(DeleteAccountWithIdTokenUseCase)
        .execute({ userId: currentUser(request).id, provider: 'apple', ...request.body })

      return reply.status(204).send(null)
    },
  )
  // prumo:end-apple

  // A provider's own sheet signed the person in on the phone: the app sends the ID token it gave, with the trip where
  // the provider took this API's nonce, and gets its tokens.
  app.post(
    '/:provider/token',
    {
      config: { public: true, ...ATTEMPTS },
      schema: {
        tags: ['auth'],
        params: providerParams,
        body: z.strictObject({
          idToken: z.string().min(1).max(8192),
          trip: z.string().min(1).max(512).optional(),
          name: z.string().trim().min(1).max(200).optional(),
        }),
        response: { 200: tokensResponseSchema },
      },
    },
    async (request, reply) => {
      const { idToken, trip, name } = request.body

      return deliver(
        request,
        reply,
        await app.container.resolve(SignInWithIdTokenUseCase).execute({
          provider: request.params.provider,
          idToken,
          trip: trip ?? null,
          name: name ?? null,
          locale: request.locale,
        }),
        200,
      )
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
