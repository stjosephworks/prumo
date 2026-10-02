export type Mail = { to: string; subject: string; text: string }

// The template writes mail to the log; a project that sends real mail replaces the adapter, not the callers.
export interface Mailer {
  send(mail: Mail): Promise<void>
}

export const MAILER = Symbol('Mailer')
