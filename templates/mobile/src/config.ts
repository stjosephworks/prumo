export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL as string,
  // prumo:google
  // Google's own sheet, once the app is registered with Google: with both ids, or through the browser without them.
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  // prumo:end-google
}
