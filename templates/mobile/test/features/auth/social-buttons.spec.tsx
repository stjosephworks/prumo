import { GoogleSignin } from '@react-native-google-signin/google-signin' // prumo:google
import { QueryClientProvider } from '@tanstack/react-query'
import { API_URL, fakeTransport, json } from '@test/support/fake-transport'
import { memoryTokenStore } from '@test/support/memory-token-store'
import { createTestQueryClient } from '@test/support/query-client'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import * as AppleAuthentication from 'expo-apple-authentication' // prumo:apple
import * as WebBrowser from 'expo-web-browser'
import { Platform } from 'react-native'
import { createAuthClient } from '@/api-contract'
import { config } from '@/config' // prumo:google
import { SocialButtons } from '@/features/auth/social-buttons'

jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }))
// prumo:apple
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}))
// prumo:end-apple
// jest-expo leaves the app manifest empty, so expo-linking cannot know the app's scheme; this one stands in for it.
jest.mock('expo-linking', () => ({
  ...jest.requireActual('expo-linking'),
  createURL: (path: string) => `acme://${path}`,
}))

// Whichever provider the project kept: each button runs the same trip.
const firstProvider = () => screen.getAllByRole('button', { name: /^Continue with / })[0] as never

const TOKENS = { accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 900 }

// What a test changed about the platform or the app's config, put back after it.
const replaced: { restore(): void }[] = []

afterEach(() => {
  for (const each of replaced.splice(0)) {
    each.restore()
  }
})

function onPlatform(os: 'ios' | 'android') {
  replaced.push(jest.replaceProperty(Platform, 'OS', os))
}

async function renderButtons(
  exchange: () => Response,
  routes: Parameters<typeof fakeTransport>[0] = {},
) {
  const tokens = memoryTokenStore()
  const onSignedIn = jest.fn()
  const auth = createAuthClient({
    baseUrl: API_URL,
    tokens,
    fetch: fakeTransport({ ...routes, 'POST /api/auth/social/exchange': exchange }),
  })

  await render(
    <QueryClientProvider client={createTestQueryClient()}>
      <SocialButtons auth={auth} onSignedIn={onSignedIn} />
    </QueryClientProvider>,
  )

  return { tokens, onSignedIn }
}

describe('SocialButtons through the browser', () => {
  // Apple's sheet exists on iOS only, and Google's needs the app registered with Google: on Android, without Google's
  // ids, every provider goes through the browser.
  beforeEach(() => {
    jest.mocked(WebBrowser.openAuthSessionAsync).mockReset()
    onPlatform('android')
  })

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

describe('SocialButtons with a provider’s own sheet', () => {
  // prumo:apple
  it('signs in with Apple’s sheet on iOS, on the API’s nonce, and sends the name Apple gives once', async () => {
    onPlatform('ios')
    jest.mocked(AppleAuthentication.signInAsync).mockResolvedValue({
      identityToken: 'apple-token',
      authorizationCode: 'code-1',
      fullName: { givenName: 'Ana', familyName: 'Silva' },
    } as Awaited<ReturnType<typeof AppleAuthentication.signInAsync>>)
    const sent: unknown[] = []
    const { tokens, onSignedIn } = await renderButtons(() => json(401, {}), {
      'POST /api/auth/social/apple/nonce': () => json(200, { trip: 'trip-1', nonce: 'nonce-1' }),
      'POST /api/auth/social/apple/token': async (request) => {
        sent.push(await request.json())
        return json(200, TOKENS)
      },
    })

    await userEvent.setup().press(screen.getByRole('button', { name: 'Continue with Apple' }))

    await waitFor(() => expect(onSignedIn).toHaveBeenCalled())
    expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith(
      expect.objectContaining({ nonce: 'nonce-1' }),
    )
    expect(sent).toEqual([{ idToken: 'apple-token', trip: 'trip-1', name: 'Ana Silva' }])
    expect(await tokens.read()).toEqual(TOKENS)
  })

  it('does nothing when Apple’s sheet is closed', async () => {
    onPlatform('ios')
    jest
      .mocked(AppleAuthentication.signInAsync)
      .mockRejectedValue(Object.assign(new Error('closed'), { code: 'ERR_REQUEST_CANCELED' }))
    const { onSignedIn } = await renderButtons(() => json(401, {}), {
      'POST /api/auth/social/apple/nonce': () => json(200, { trip: 'trip-1', nonce: 'nonce-1' }),
    })

    await userEvent.setup().press(screen.getByRole('button', { name: 'Continue with Apple' }))

    await waitFor(() => expect(AppleAuthentication.signInAsync).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onSignedIn).not.toHaveBeenCalled()
  })
  // prumo:end-apple

  // prumo:google
  it('signs in with Google’s sheet once the app is registered with Google', async () => {
    replaced.push(jest.replaceProperty(config, 'googleWebClientId', 'web-client'))
    replaced.push(jest.replaceProperty(config, 'googleIosClientId', 'ios-client'))
    jest.mocked(GoogleSignin.signIn).mockResolvedValue({
      type: 'success',
      data: { idToken: 'google-token' },
    } as Awaited<ReturnType<typeof GoogleSignin.signIn>>)
    const sent: unknown[] = []
    const { onSignedIn } = await renderButtons(() => json(401, {}), {
      'POST /api/auth/social/google/token': async (request) => {
        sent.push(await request.json())
        return json(200, TOKENS)
      },
    })

    await userEvent.setup().press(screen.getByRole('button', { name: 'Continue with Google' }))

    await waitFor(() => expect(onSignedIn).toHaveBeenCalled())
    expect(GoogleSignin.configure).toHaveBeenCalledWith({
      webClientId: 'web-client',
      iosClientId: 'ios-client',
    })
    expect(sent).toEqual([{ idToken: 'google-token' }])
    expect(GoogleSignin.signOut).toHaveBeenCalled()
  })
  // prumo:end-google
})
