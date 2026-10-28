import type { TextMessage, TextMessages } from '@/domain/auth/ports/text-messages.port'

// Keeps what would have been sent, so a test reads the code the way a person reads their phone.
export class FakeTextMessages implements TextMessages {
  readonly sent: TextMessage[] = []

  async send(message: TextMessage): Promise<void> {
    this.sent.push(message)
  }

  lastCode(to: string): string {
    const message = this.sent.findLast((each) => each.to === to)
    const code = message === undefined ? undefined : /\b\d{6}\b/.exec(message.text)?.[0]

    if (code === undefined) {
      throw new Error(`No code was texted to ${to}`)
    }

    return code
  }
}
