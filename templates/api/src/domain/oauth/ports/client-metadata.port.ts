export type ClientMetadata = { clientId: string; clientName: string; redirectUris: string[] }

// A client identifies itself by the HTTPS URL of a document describing it. Reading one that is missing, malformed,
// or not a public client's throws InvalidClientError.
export interface ClientMetadataSource {
  read(clientId: string): Promise<ClientMetadata>
}

export const CLIENT_METADATA = Symbol('ClientMetadataSource')
