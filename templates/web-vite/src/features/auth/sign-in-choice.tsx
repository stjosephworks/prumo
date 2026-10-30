import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useMessages } from '@/i18n/i18n'

// The sign-in page holds the ways in the project has. A code leads when there is one, since it works for an account,
// for no account yet and for a forgotten password; a password then waits behind a link.
export function SignInChoice({ code, password }: { code?: ReactNode; password?: ReactNode }) {
  const messages = useMessages()
  const [withPassword, setWithPassword] = useState(false)

  if (code === undefined || password === undefined) {
    return code ?? password
  }

  return withPassword ? (
    <>
      {password}
      <Button type="button" variant="link" onClick={() => setWithPassword(false)}>
        {messages.auth.signIn.withCode}
      </Button>
    </>
  ) : (
    <>
      {code}
      <Button type="button" variant="link" onClick={() => setWithPassword(true)}>
        {messages.auth.signIn.withPassword}
      </Button>
    </>
  )
}
