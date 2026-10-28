import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

// On a sign-in page that also takes a code, the password waits behind a link; without one, it is already there.
export async function withPassword(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await screen.findByRole('heading', { name: 'Sign in' })

  const link = screen.queryByRole('button', { name: 'Sign in with a password' })

  if (link !== null) {
    await user.click(link)
  }
}
