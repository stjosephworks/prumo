import { Pressable, Text, View } from 'react-native'
import { type Choice, useI18n } from '@/i18n/i18n'
import { LOCALE_INFO, LOCALES } from '@/i18n/locales'

// The language of the app: the phone's, or one chosen here and kept on the phone. Signed in, the account follows it
// (account-language.ts). A project that speaks one language has nothing to choose.
export function LanguageSwitcher() {
  const { chosen, messages, choose } = useI18n()

  if (LOCALES.length < 2) {
    return null
  }

  const options: { choice: Choice; label: string }[] = [
    { choice: 'system', label: messages.followSystem },
    ...LOCALES.map((locale) => ({ choice: locale, label: LOCALE_INFO[locale].nativeName })),
  ]

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={messages.language}
      className="flex-row flex-wrap gap-2"
    >
      {options.map(({ choice, label }) => (
        <Pressable
          key={choice}
          accessibilityRole="radio"
          accessibilityLabel={label}
          accessibilityState={{ checked: chosen === choice }}
          onPress={() => choose(choice)}
          className={`rounded-full border px-3 py-1 ${chosen === choice ? 'border-neutral-900' : 'border-neutral-300'}`}
        >
          <Text className="text-sm text-neutral-900">{label}</Text>
        </Pressable>
      ))}
    </View>
  )
}
