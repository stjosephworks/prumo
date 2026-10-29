import { messages } from '@test/support/messages'
import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

// Signs in through the form the page leads with: a code when the project has one, by email or else by phone, and
// otherwise the password. The fake API answers every sign-in route alike. Each way in is cut with its feature, so a
// project's copy only names the words its own messages carry.
export async function signInThroughPage(
  user: ReturnType<typeof userEvent.setup>,
  email: string,
): Promise<void> {
  await screen.findByRole('heading', { name: messages.auth.signIn.title })

  // prumo:code-sign-in
  const sendCode = screen.queryByRole('button', { name: messages.auth.code.send })

  if (sendCode !== null) {
    // prumo:email-code
    const byEmail = screen.queryByLabelText(messages.auth.email)

    if (byEmail !== null) {
      await user.type(byEmail, email)
    }

    // prumo:end-email-code
    // prumo:phone-code
    const byPhone = screen.queryByLabelText(messages.auth.code.phone)

    if (byPhone !== null) {
      await user.type(byPhone, '+14155552671')
    }

    // prumo:end-phone-code
    await user.click(sendCode)
    await user.type(await screen.findByLabelText(messages.forms.code), '123456')
    await user.click(screen.getByRole('button', { name: messages.auth.signIn.submit }))
    return
  }

  // prumo:end-code-sign-in
  // prumo:password
  await user.type(screen.getByLabelText(messages.auth.email), email)
  await user.type(screen.getByLabelText(messages.auth.signIn.password), 'correct-horse-battery')
  await user.click(screen.getByRole('button', { name: messages.auth.signIn.submit }))
  // prumo:end-password
}
