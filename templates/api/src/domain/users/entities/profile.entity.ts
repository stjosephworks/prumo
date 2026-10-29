export const LOCALES = ['en', 'pt-BR'] as const

export type Locale = (typeof LOCALES)[number]

export const DISPLAY_NAME_MAX = 80

export type ProfileChanges = Partial<Pick<Profile, 'displayName' | 'locale' | 'timezone'>>

// What a device says about its user when an account is created there, in the device's own words.
export type DevicePreferences = { locale?: string; timezone?: string }

export class Profile {
  id: string
  userId: string
  displayName: string
  locale: Locale
  timezone: string
  createdAt: Date
  updatedAt: Date

  constructor(userId: string, displayName: string, preferences: DevicePreferences = {}) {
    this.userId = userId
    this.displayName = displayName
    this.locale = Profile.localeFor(preferences.locale)
    this.timezone = preferences.timezone ?? 'UTC'
  }

  // What an account created without a name is called until its owner says otherwise: the email's local part.
  static nameFor(email: string): string {
    return (email.split('@')[0] || email).slice(0, DISPLAY_NAME_MAX)
  }

  // prumo:phone-code
  // What an account created by a phone is called until its owner says otherwise: the number's last digits.
  static nameForPhone(phone: string): string {
    return `•••• ${phone.slice(-4)}`
  }

  // prumo:end-phone-code
  // A device names its language as it likes (`pt`, `en-US`): the same tag when supported, else the first supported
  // one in the same language, else English.
  static localeFor(requested: string | undefined): Locale {
    const language = requested?.split('-')[0]?.toLowerCase()

    return (
      LOCALES.find((locale) => locale === requested) ??
      LOCALES.find((locale) => locale.split('-')[0] === language) ??
      'en'
    )
  }

  update(changes: ProfileChanges): void {
    this.displayName = changes.displayName ?? this.displayName
    this.locale = changes.locale ?? this.locale
    this.timezone = changes.timezone ?? this.timezone
  }
}
