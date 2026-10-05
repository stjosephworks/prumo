import type { ProviderName } from '@/domain/auth/ports/identity-providers.port'

// A user as a provider knows them. The provider's subject, not the email, is what recognises them next time: an
// email can change at the provider, a subject cannot.
export class Identity {
  id: string
  userId: string
  provider: ProviderName
  subject: string
  createdAt: Date
  updatedAt: Date

  constructor(userId: string, provider: ProviderName, subject: string) {
    this.userId = userId
    this.provider = provider
    this.subject = subject
  }
}
