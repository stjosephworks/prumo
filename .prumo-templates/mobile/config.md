# Configuration

## Rule

Embed only values that are public by nature: the API base URL, and a third-party **publishable** key
where the project uses such a service.

**Never embed a secret.** A feature that needs one is performed by the API, and the app calls the API.

<!-- prumo:google -->
An OAuth client's id is public by nature, so Google's sheet reads its ids from `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and
`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`; the client's secret stays on the API.
<!-- prumo:end-google -->

Read configuration from `EXPO_PUBLIC_*` variables in **one** module that exports a typed object. Use
static dot notation there. Nothing else in the app touches `process.env`.

Verify in the build pipeline that every expected variable exists, and fail the build when one is missing.
Do it in `app.config.ts`, which Expo evaluates before bundling: throw when a variable is absent. Do not validate
at runtime.

Set the variables in the pipeline's environment. **`expo export` reads them from the environment, not from
`.env`.**

Keep `.env` in `.gitignore` and commit `.env.example` with every variable and a safe sample value.

## Rationale

**There is no safe place in an app build.** Whoever holds the `.apk` or `.ipa` reads any string inside it.
Expo states this directly: *"Do not store sensitive info, such as private keys, in `EXPO_PUBLIC_`
variables. These variables will be visible in plain-text in your compiled application."*

This is the opposite of the API, where an environment variable is the correct place for a secret. The
criterion here is: **would this still be safe printed on a billboard?** A publishable key is designed for
exactly that; it is what the name means.

Obfuscating a secret instead would be a speed bump, extractable in minutes from the binary. Its worst
quality is not weakness but the *sense* of protection, which leads to embedding things nobody would embed
knowing they were exposed.

One config module, because Expo inlines only static dot notation (`process.env['X']` is not replaced), so
every variable must appear literally somewhere. Gathering those reads in one file is what that constraint
already forces, and it means the module is also the list of what is baked into the binary.

Validation belongs to the build because that is where the fix is cheap: a missing variable found then is
two minutes, and found at boot it is a store submission and a review. At boot there is also nothing left
to detect: an absent variable was replaced by `undefined` at bundle time, so it is a constant rather than
a missing value.

`app.config.ts` rather than a separate script, because Expo evaluates it on every bundle and every build: there
is no command that produces a binary without passing through it. **`.env` does not reach it during export:**
verified with Expo SDK 57, `expo config` loads `.env` while `expo export` evaluated the configuration without it
and failed. That is harmless in a pipeline, where the variables come from its environment, and surprising on a
laptop, which is why the template's README says so.

## Applies to

The config module, the `.env` files, and the build pipeline.

## Examples

What may be embedded:

```
✅  EXPO_PUBLIC_API_URL=https://api.example.com
❌  EXPO_PUBLIC_STRIPE_SECRET_KEY=sk_live_…
❌  EXPO_PUBLIC_DATABASE_URL=postgres://…
```

How it is read:

```
✅  // config.ts
    export const config = { apiUrl: process.env.EXPO_PUBLIC_API_URL }
❌  process.env[`EXPO_PUBLIC_${name}`]     // not inlined; always undefined
❌  process.env.EXPO_PUBLIC_API_URL        // scattered through feature files
```

## Enforcement

**Build.** The pipeline fails when an expected variable is missing, which is the only moment the fix is
cheap.

**Review only, and it is the line that matters:** that nothing secret was added to a variable. Nothing
breaks if it is: the app works exactly as before, and the value is simply readable by anyone who
downloads it.

A feature that appears to need a secret in the app is a feature that belongs on the server. That is the
question to ask before adding a variable, not after.
