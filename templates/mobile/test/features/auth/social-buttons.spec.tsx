import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { API_URL, fakeTransport, json } from '@test/support/fake-transport'
import { memoryTokenStore } from '@test/support/memory-token-store'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import * as WebBrowser from 'expo-web-browser'
import { createAuthClient } from '@/api-contract'
import { SocialButtons } from '@/features/auth/social-buttons'

jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }))
// jest-expo leaves the app manifest empty, so expo-linking cannot know the app's scheme; this one stands in for it.
jest.mock('expo-linking', () => ({
  ...jest.requireActual('expo-linking'),
  createURL: (path: string) => `acme://${path}`,
}))

// Whichever provider the project kept: each button runs the same trip.
const firstProvider = () => screen.getAllByRole('button', { name: /^Continue with / })[0] as never

const TOKENS = { accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 900 }

async function renderButtons(exchange: () => Response) {
  const tokens = memoryTokenStore()
  const onSignedIn = jest.fn()
  const auth = createAuthClient({
    baseUrl: API_URL,
    tokens,
    fetch: fakeTransport({ 'POST /api/auth/social/exchange': exchange }),
  })

  await render(
    <QueryClientProvider client={new QueryClient()}>
      <SocialButtons auth={auth} onSignedIn={onSignedIn} />
    </QueryClientProvider>,
  )

  return { tokens, onSignedIn }
}

describe('SocialButtons', () => {
  beforeEach(() => jest.mocked(WebBrowser.openAuthSessionAsync).mockReset())

  it('opens the provider through the API and trades the code it comes back with', async () => {
    jest
      .mocked(WebBrowser.openAuthSessionAsync)
      .mockResolvedValue({ type: 'success', url: 'acme://social?code=flow.secret' })
    const { tokens, onSignedIn } = await renderButtons(() => json(200, TOKENS))

    await userEvent.setup().press(firstProvider())

    await waitFor(() => expect(onSignedIn).toHaveBeenCalled())
    expect(jest.mocked(WebBrowser.openAuthSessionAsync).mock.calls[0]?.[0]).toMatch(
      new RegExp(`^${API_URL}/api/auth/social/\\w+\\?client=mobile&returnTo=%2F$`),
    )
    expect(await tokens.read()).toEqual(TOKENS)
  })

  it('does nothing when the browser is closed, and says so when the code is refused', async () => {
    jest
      .mocked(WebBrowser.openAuthSessionAsync)
      .mockResolvedValueOnce({ type: 'cancel' } as Awaited<
        ReturnType<typeof WebBrowser.openAuthSessionAsync>
      >)
    const { onSignedIn } = await renderButtons(() => json(401, {}))
    const user = userEvent.setup()

    await user.press(firstProvider())
    expect(screen.queryByRole('alert')).toBeNull()

    jest
      .mocked(WebBrowser.openAuthSessionAsync)
      .mockResolvedValueOnce({ type: 'success', url: 'acme://social?code=used' })
    await user.press(firstProvider())

    expect(await screen.findByRole('alert')).toHaveTextContent(/did not complete/)
    expect(onSignedIn).not.toHaveBeenCalled()
  })
})
