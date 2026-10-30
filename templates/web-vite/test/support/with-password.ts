import { messages } from '@test/support/messages'
import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

// On a sign-in page that also takes a code, the password waits behind a link; without one, it is already there.
export async function withPassword(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await screen.findByRole('heading', { name: messages.auth.signIn.title })

  const link = screen.queryByRole('button', { name: messages.auth.signIn.withPassword })

  if (link !== null) {
    await user.click(link)
  }
}
