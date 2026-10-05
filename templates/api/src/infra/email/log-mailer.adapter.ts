import type { Mail, Mailer } from '@/domain/auth/ports/mailer.port'

// Writes each mail to the log instead of sending it: enough to develop against, and nothing to sign up for. A
// project that sends real mail gives the Mailer port another adapter; see .prumo/email/.
export class LogMailer implements Mailer {
  constructor(private readonly write: (line: string) => void) {}

  async send(mail: Mail): Promise<void> {
    this.write(`[mail] to ${mail.to}: ${mail.subject}\n${mail.text}`)
  }
}
