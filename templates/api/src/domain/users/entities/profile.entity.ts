import { type Locale, negotiateLocale } from '@/i18n/locales'

export const DISPLAY_NAME_MAX = 80

export type ProfileChanges = Partial<Pick<Profile, 'displayName' | 'locale' | 'timezone'>>

// What a device says about its user when an account is created there, in the device's own words: the language its
// screen speaks and its timezone.
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
    // The language the screen speaks, as the project speaks it, else the project's base.
    this.locale = negotiateLocale([preferences.locale])
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
  update(changes: ProfileChanges): void {
    this.displayName = changes.displayName ?? this.displayName
    this.locale = changes.locale ?? this.locale
    this.timezone = changes.timezone ?? this.timezone
  }
}
