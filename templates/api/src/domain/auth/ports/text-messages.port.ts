export type TextMessage = { to: string; text: string }

// Every text message the API sends goes through here, as every mail goes through the Mailer.
export interface TextMessages {
  send(message: TextMessage): Promise<void>
}

export const TEXT_MESSAGES = Symbol('TextMessages')
