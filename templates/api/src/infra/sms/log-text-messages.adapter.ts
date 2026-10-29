import type { TextMessage, TextMessages } from '@/domain/auth/ports/text-messages.port'

// Writes each text to the log instead of sending it: enough to develop against, and nothing to pay for. A project
// that sends real texts gives the TextMessages port another adapter; see .prumo/phone/.
export class LogTextMessages implements TextMessages {
  constructor(private readonly write: (line: string) => void) {}

  async send(message: TextMessage): Promise<void> {
    this.write(`[sms] to ${message.to}: ${message.text}`)
  }
}
