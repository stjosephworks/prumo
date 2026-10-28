import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

// Signs in through the form the page leads with: a code when the project has one, by email or else by phone, and
// otherwise the password. The fake API answers every sign-in route alike.
export async function signInThroughPage(
  user: ReturnType<typeof userEvent.setup>,
  email: string,
): Promise<void> {
  await screen.findByRole('heading', { name: 'Sign in' })

  const sendCode = screen.queryByRole('button', { name: 'Send me a code' })

  if (sendCode === null) {
    await user.type(screen.getByLabelText('Email'), email)
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
  } else {
    const byEmail = screen.queryByLabelText('Email')

    await user.type(
      byEmail ?? screen.getByLabelText('Phone number'),
      byEmail ? email : '+14155552671',
    )
    await user.click(sendCode)
    await user.type(await screen.findByLabelText('Code'), '123456')
  }

  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}
