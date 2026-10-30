import { type ReactNode, useState } from 'react'
import { Pressable, Text } from 'react-native'
import { useMessages } from '@/i18n/i18n'

function Switch({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      <Text className="text-sm text-neutral-900 underline">{label}</Text>
    </Pressable>
  )
}

// The sign-in screen holds the ways in the project has. A code leads when there is one, since it works for an
// account, for no account yet and for a forgotten password; a password then waits behind a link.
export function SignInChoice({ code, password }: { code?: ReactNode; password?: ReactNode }) {
  const messages = useMessages()
  const [withPassword, setWithPassword] = useState(false)

  if (code === undefined || password === undefined) {
    return code ?? password
  }

  return withPassword ? (
    <>
      {password}
      <Switch label={messages.auth.signIn.withCode} onPress={() => setWithPassword(false)} />
    </>
  ) : (
    <>
      {code}
      <Switch label={messages.auth.signIn.withPassword} onPress={() => setWithPassword(true)} />
    </>
  )
}
