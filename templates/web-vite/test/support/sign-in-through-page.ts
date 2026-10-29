import { messages } from '@test/support/messages'
import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

// Signs in through the form the page leads with: a code when the project has one, by email or else by phone, and
// otherwise the password. The fake API answers every sign-in route alike.
export async function signInThroughPage(
  user: ReturnType<typeof userEvent.setup>,
  email: string,
): Promise<void> {
  await screen.findByRole('heading', { name: messages.auth.signIn.title })

  const sendCode = screen.queryByRole('button', { name: messages.auth.code.send })

  if (sendCode === null) {
    await user.type(screen.getByLabelText(messages.auth.email), email)
    await user.type(screen.getByLabelText(messages.auth.signIn.password), 'correct-horse-battery')
  } else {
    const byEmail = screen.queryByLabelText(messages.auth.email)

    await user.type(
      byEmail ?? screen.getByLabelText(messages.auth.code.phone),
      byEmail ? email : '+14155552671',
    )
    await user.click(sendCode)
    await user.type(await screen.findByLabelText(messages.forms.code), '123456')
  }

  await user.click(screen.getByRole('button', { name: messages.auth.signIn.submit }))
}
