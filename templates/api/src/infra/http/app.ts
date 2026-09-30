import { randomUUID } from 'node:crypto'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { EntityManager } from '@mikro-orm/postgresql'
import Fastify, { type FastifyInstance } from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import type { DependencyContainer } from 'tsyringe'
import { ENV, type Env } from '@/infra/config/env'
import { authController } from '@/infra/http/controllers/auth.controller'
import { healthController } from '@/infra/http/controllers/health.controller'
import { mcpController } from '@/infra/http/controllers/mcp.controller' // prumo:mcp
import { usersController } from '@/infra/http/controllers/users.controller'
import { registerErrorHandler } from '@/infra/http/errors/error-handler'
import { registerAuthHook } from '@/infra/http/hooks/auth.hook'
import { registerRequestContext } from '@/infra/http/hooks/request-context.hook'

const DOCS = '/api/docs'
const VERSIONED = '/api/v'

function logger(env: Env) {
  if (env.NODE_ENV === 'test') {
    return false
  }

  return {
    level: env.LOG_LEVEL,
    redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
  }
}

function requireResponseSchemas(app: FastifyInstance): void {
  // Without a response schema Fastify falls back to JSON.stringify, and every column of the entity leaves.
  app.addHook('onRoute', (route) => {
    if (route.url.startsWith(VERSIONED) && route.schema?.response === undefined) {
      throw new Error(`${String(route.method)} ${route.url} declares no response schema`)
    }
  })
}

async function registerDocs(app: FastifyInstance): Promise<void> {
  // The UI's own routes are declared by the plugin, which cannot be told they are public.
  app.addHook('onRoute', (route) => {
    if (route.url.startsWith(DOCS)) {
      route.config = { ...route.config, public: true }
    }
  })

  await app.register(swagger, {
    openapi: { info: { title: 'API', version: '1' } },
    transform: jsonSchemaTransform,
  })
  await app.register(swaggerUi, { routePrefix: DOCS })
}

export async function buildApp(container: DependencyContainer): Promise<FastifyInstance> {
  const env = container.resolve<Env>(ENV)
  const app = Fastify({
    logger: logger(env),
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
  })

  app.decorate('container', container)
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  registerErrorHandler(app)
  requireResponseSchemas(app)
  registerRequestContext(app, container.resolve(EntityManager))

  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
    // Without a list, only the CORS-safelisted GET, HEAD and POST pass a preflight.
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    exposedHeaders: ['X-Request-Id'],
  })

  if (env.NODE_ENV !== 'production') {
    await registerDocs(app)
  }

  registerAuthHook(app)

  await app.register(authController)
  await app.register(healthController, { prefix: '/api/health' })
  await app.register(usersController, { prefix: '/api/v1/users' })
  // prumo:mcp
  await app.register(mcpController, { prefix: '/api/mcp' })
  // prumo:end-mcp

  return app
}
