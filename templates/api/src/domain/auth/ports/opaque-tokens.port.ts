// Random values that are handed out once and stored only as a digest.
export interface OpaqueTokens {
  create(): string
  digest(token: string): string
}

export const OPAQUE_TOKENS = Symbol('OpaqueTokens')
