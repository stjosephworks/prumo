import type { Mail, Mailer } from '@/domain/auth/ports/mailer.port'

// Keeps what would have been sent, so a test reads the code the way a person reads their inbox.
export class FakeMailer implements Mailer {
  readonly sent: Mail[] = []

  async send(mail: Mail): Promise<void> {
    this.sent.push(mail)
  }

  lastCode(to: string): string {
    const mail = this.sent.findLast((each) => each.to === to)
    const code = mail === undefined ? undefined : /\b\d{6}\b/.exec(mail.text)?.[0]

    if (code === undefined) {
      throw new Error(`No code was sent to ${to}`)
    }

    return code
  }
}
