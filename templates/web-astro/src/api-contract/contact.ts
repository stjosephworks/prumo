import type { Session } from './auth'
import type { ApiClient } from './client'

// How the signed-in person is reached, and so signs in. A change asks for a sign-in of moments ago: otherwise the API
// refuses with 403 `reauthentication_required`. A code goes to the new address only when nobody has it, and the
// answer is the same either way.

// prumo:mail
export const requestEmailChange = (client: ApiClient, email: string) =>
  client.post<void>('/users/me/email/code', { email })

export const changeEmail = (client: ApiClient, request: { email: string; code: string }) =>
  client.post<Session>('/users/me/email', request)

// prumo:end-mail
// prumo:sms
export const requestPhoneChange = (client: ApiClient, phone: string) =>
  client.post<void>('/users/me/phone/code', { phone })

export const changePhone = (client: ApiClient, request: { phone: string; code: string }) =>
  client.post<Session>('/users/me/phone', request)
// prumo:end-sms
