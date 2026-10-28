# Text messages

## Rule

Send every text through the `TextMessages` port in `src/domain/auth/ports/text-messages.port.ts`. A use case
composes the `TextMessage` (`to`, `text`) and hands it over; nothing else in the domain knows how a text travels.

Keep `LogTextMessages`, which writes each text to the API's log in a line starting `[sms] to`, as the adapter until
the project sends real texts. Read a code during development from that log.

To send real texts, write a second adapter under `src/infra/sms/` and register it in `codes.di.ts` in place of
`LogTextMessages`, for production only, with its credentials validated in `env.ts`. The adapter only sends: the
code is the API's, generated and checked by `IssueCodeUseCase`. A provider's verification product, which generates
and checks codes of its own, is not this port.

A real adapter catches a failed send, logs it at `error` with the provider's answer, and returns. The route that
asked answers the same either way.

In a test, register a `FakeTextMessages` and read the code from it, as `test/support/test-app.ts` does.

## Rationale

Sending texts needs an account with a provider and a budget, which is the project owner's decision, so the template
ships the port and an adapter that needs neither: sign-in by phone works end to end from the first `pnpm dev`.

Keeping the code the API's own means one table, one set of limits and one set of tests for every channel. A
verification product would hold the code at the provider, with limits of its own and a second idea of when a code
is spent.

**What this costs:** until an adapter is written, a deployed API texts nobody, and a person waiting for a code
never receives it. Nothing warns about that but this document and the warning `prumo new` printed.

## Applies to

Every text the API sends.

## Examples

```
✅  await this.texts.send({ to, text })
❌  await twilio.messages.create({ … })                // inside a use case

✅  container.register(TEXT_MESSAGES, { useValue: new ProviderTextMessages(env) })   // production adapter
❌  a provider's verification API checking the code   // two places decide when a code is spent
```

## Enforcement

**Tests.** The suite reads every texted code through `FakeTextMessages`, so a flow that stops sending fails.

**Review only.** That production registers a real adapter. `LogTextMessages` in production texts nobody.
