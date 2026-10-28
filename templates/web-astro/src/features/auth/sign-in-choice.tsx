import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CodeSignInPart } from '@/features/auth/code-sign-in-form' // prumo:code-sign-in
import { SignInPart } from '@/features/auth/sign-in-form' // prumo:password
import { island } from '@/features/clients/island'

// The sign-in page holds the ways in the project has. A code leads when there is one, since it works for an account,
// for no account yet and for a forgotten password; a password then waits behind a link.
function SignInChoice({ code, password }: { code?: ReactNode; password?: ReactNode }) {
  const [withPassword, setWithPassword] = useState(false)

  if (code === undefined || password === undefined) {
    return code ?? password
  }

  return withPassword ? (
    <>
      {password}
      <Button type="button" variant="link" onClick={() => setWithPassword(false)}>
        Sign in with a code instead
      </Button>
    </>
  ) : (
    <>
      {code}
      <Button type="button" variant="link" onClick={() => setWithPassword(true)}>
        Sign in with a password
      </Button>
    </>
  )
}

// One island for every way in, so switching between them keeps the page.
function SignInWaysPart() {
  return (
    <SignInChoice
      code={<CodeSignInPart />} // prumo:code-sign-in
      password={<SignInPart />} // prumo:password
    />
  )
}

export const SignInWays = island(SignInWaysPart)
