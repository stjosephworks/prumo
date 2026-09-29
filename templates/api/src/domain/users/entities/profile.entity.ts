export const LOCALES = ['en', 'pt-BR'] as const

export type Locale = (typeof LOCALES)[number]

export type ProfileChanges = Partial<Pick<Profile, 'displayName' | 'locale' | 'timezone'>>

export class Profile {
  id: string
  userId: string
  displayName: string
  locale: Locale
  timezone: string
  createdAt: Date
  updatedAt: Date

  constructor(userId: string, displayName: string) {
    this.userId = userId
    this.displayName = displayName
  }

  update(changes: ProfileChanges): void {
    this.displayName = changes.displayName ?? this.displayName
    this.locale = changes.locale ?? this.locale
    this.timezone = changes.timezone ?? this.timezone
  }
}
