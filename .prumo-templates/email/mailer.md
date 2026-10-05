# Mailer

## Rule

Send every email through the `Mailer` port in `src/domain/auth/ports/mailer.port.ts`. A use case composes the
`Mail` (`to`, `subject`, `text`) and hands it over; nothing else in the domain knows how mail travels.

Keep `LogMailer`, which writes each mail to the API's log, as the adapter until the project sends real mail.
Read a code during development from that log.

To send real mail, write a second adapter under `src/infra/email/` and register it in `email.di.ts` in place of
`LogMailer`, for production only. Either speak SMTP, with `nodemailer` and an `SMTP_URL` any provider accepts, or
call a provider's HTTP API. Validate the new variable in `env.ts`.

In a test, register a `FakeMailer` and read the code from it, as `test/support/test-app.ts` does.

## Rationale

Sending mail needs an account with somebody, and choosing one is a commercial decision the project's owner
makes, not the template. So the template ships the port and an adapter that needs nothing, and the flows that
depend on mail work end to end from the first `pnpm dev`: the code is in the terminal.

The port is the whole contract on purpose. SES, Postmark, Resend, Mailgun and a company relay all accept the
same three fields, so changing provider is one new adapter and one line in the container.

**What this costs:** until an adapter is written, a deployed API sends nothing, and a user waiting for a code
never receives it. Nothing warns about that but this document.

## Applies to

Every email the API sends, now and later: codes, invitations, receipts.

## Examples

```
✅  await this.mailer.send({ to, subject, text })
❌  await fetch('https://api.provider.example/send', …)     // inside a use case

✅  container.register(MAILER, { useValue: new SmtpMailer(env) })   // production adapter
❌  if (env.NODE_ENV === 'production') { … }               // inside LogMailer
```

## Enforcement

**Tests.** The suite reads every code through `FakeMailer`, so a flow that stops sending mail fails.

**Review only.** That production registers a real adapter. `LogMailer` in production loses mail silently.
