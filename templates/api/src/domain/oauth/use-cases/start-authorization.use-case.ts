import { inject, injectable } from 'tsyringe'
import { Authorization } from '@/domain/oauth/entities/authorization.entity'
import { AuthorizationRequestError } from '@/domain/oauth/errors/authorization-request.error'
import { InvalidClientError } from '@/domain/oauth/errors/invalid-client.error'
import {
  CLIENT_METADATA,
  type ClientMetadataSource,
} from '@/domain/oauth/ports/client-metadata.port'
import {
  AUTHORIZATION_REPOSITORY,
  type AuthorizationRepository,
} from '@/domain/oauth/repositories/authorization.repository'

// RFC 7636: 43 to 128 characters from the unreserved set.
const CODE_CHALLENGE = /^[A-Za-z0-9\-._~]{43,128}$/

export type AuthorizeRequest = {
  responseType: string | undefined
  clientId: string
  redirectUri: string
  codeChallenge: string | undefined
  codeChallengeMethod: string | undefined
  clientState: string | null
  resource: string | undefined
}

@injectable()
export class StartAuthorizationUseCase {
  constructor(
    @inject(CLIENT_METADATA) private readonly clients: ClientMetadataSource,
    @inject(AUTHORIZATION_REPOSITORY) private readonly authorizations: AuthorizationRepository,
  ) {}

  // The client and its redirect URI are checked first: until both are, no error may be sent anywhere.
  async execute(request: AuthorizeRequest, expectedResource: string): Promise<Authorization> {
    const client = await this.clients.read(request.clientId)

    // Exact match only: a prefix or a pattern is how an authorization code ends up somewhere else.
    if (!client.redirectUris.includes(request.redirectUri)) {
      throw new InvalidClientError('redirect_uri is not one the client registered')
    }

    if (request.responseType !== 'code') {
      throw new AuthorizationRequestError('unsupported_response_type', 'Only response_type=code')
    }

    if (
      request.codeChallengeMethod !== 'S256' ||
      !CODE_CHALLENGE.test(request.codeChallenge ?? '')
    ) {
      throw new AuthorizationRequestError('invalid_request', 'PKCE with S256 is required')
    }

    // RFC 8707: the token is for one resource, and this server has one.
    if (request.resource !== expectedResource) {
      throw new AuthorizationRequestError('invalid_target', `resource must be ${expectedResource}`)
    }

    const authorization = new Authorization(
      {
        clientId: request.clientId,
        clientName: client.clientName,
        redirectUri: request.redirectUri,
        codeChallenge: request.codeChallenge as string,
        clientState: request.clientState,
        resource: expectedResource,
      },
      new Date(),
    )

    await this.authorizations.save(authorization)

    return authorization
  }
}
