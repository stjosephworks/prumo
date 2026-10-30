// The phone in a test names no language, so the app speaks the project's base, whichever it is, and the words a test
// looks for come from its messages (support/messages.ts).
jest.mock('expo-localization', () => ({ getLocales: () => [], useLocales: () => [] }))
