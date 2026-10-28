import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

// Signs in through the form the page leads with: the code when the project has one, else the password. The fake
// API answers `POST /api/auth/email/sign-in` and `POST /api/auth/sign-in` alike.
export async function signInThroughPage(
  user: ReturnType<typeof userEvent.setup>,
  email: string,
): Promise<void> {
  await screen.findByRole('heading', { name: 'Sign in' })
  await user.type(screen.getByLabelText('Email'), email)

  const sendCode = screen.queryByRole('button', { name: 'Email me a code' })

  if (sendCode !== null) {
    await user.click(sendCode)
    await user.type(await screen.findByLabelText('Code'), '123456')
  } else {
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
  }

  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}
