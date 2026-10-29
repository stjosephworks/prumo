// Google's sheet is a native module, which Jest has none of, and importing the package asks for it. Every test gets
// this stand-in; one that signs in with Google tells it what to answer.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
}))
