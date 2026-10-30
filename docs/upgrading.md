# Upgrading a project

Prumo writes a project once and does not come back to it. There is no `prumo upgrade`, and updating a
project's `.prumo/` in place comes after 1.0. What a later version changed in the files it generates is
listed here, so a team can carry the change over by hand.

The version that generated a project is `prumo` in its `.prumo/config.json`. A config without that field was
written by 0.1.0.

## The method

Generate two reference projects with the same answers, one at the version the project came from and one at
the version you are moving to. The difference between them is what Prumo changed; the difference between the
older one and your project is what your team changed.

1. Read the answers from `.prumo/config.json` and turn each into its flag:

   | Field | Flag |
   |---|---|
   | `types` | `--types api,web` |
   | `apps` | `--app <name>=<type>` for each app whose name is not its type, in order; those types leave `--types`. A web app with a `framework` other than `vite` is `web:<framework>`, in `--types` or `--app` |
   | `architecture` | `--alone` or `--monorepo` |
   | `multiTenant` | `--multi-tenant` or `--single-tenant` |
   | `mcp` | `--mcp` or `--no-mcp` |
   | `email` | `--email` or `--no-email` |
   | `social` | `--social google,apple`, or `--no-social` when it is empty |

   `apps` exists from 0.6.0, and only in a workspace until 0.8.0, which writes it for every project with each web
   app's `framework`. Before 0.8.0 every web app was Vite's. A `site` in `types` became `web:next` in 0.8.0: see below.

   `email` and `social` exist from 0.4.0. A project generated before has neither, so its reference at the old
   version leaves both flags out, and its reference at the new one passes `--no-email --no-social`.

2. Generate both, under the project's own name so that nothing differs by name alone:

   ```sh
   mkdir ../ref-old ../ref-new
   (cd ../ref-old && npx @stjoseph/prumo@0.4.2 new acme --types api,web --monorepo --single-tenant --no-mcp --no-email --no-social --skip-install)
   (cd ../ref-new && npx @stjoseph/prumo@0.5.1 new acme --types api,web --monorepo --single-tenant --no-mcp --no-email --no-social --skip-install)
   ```

3. Diff each file the sections below list:

   ```sh
   git diff --no-index ../ref-old/acme/scripts/ports.mjs ../ref-new/acme/scripts/ports.mjs   # what Prumo changed
   git diff --no-index ../ref-old/acme/scripts/ports.mjs scripts/ports.mjs                   # what your team changed
   ```

   When the second diff is empty, copy the new file over. When it is not, the file is the team's now: apply
   Prumo's change to it by hand, and keep what the team wrote.

**Do not overwrite blindly.** A generated file the team edited carries decisions Prumo knows nothing about,
and copying the new version deletes them without a trace. That holds most of all for `package.json`,
`README.md`, `.env` (whose secret is generated afresh for every project) and the `.prumo/` documents, which
belong to the team from the day they are written.

With `--skip-install` the formatter does not run, so a workspace reference keeps the contract import as the
template writes it. Formatting never touches the files listed here.

## Where a file lands

A path below is given as the project sees it when generated `alone`. In a workspace, each app's files sit under
`apps/<name>/`, the name being the app's type unless it was named on purpose, and the workspace root holds its own
`scripts/ports.mjs`, `.githooks/`, `.gitattributes` and `.github/`: an app inside a workspace has none of the last
three of its own.

## What changed, release by release

### 0.10.0

| File | Types | Change |
|---|---|---|
| `.context/INDEX.md`, `AGENTS.md`, `.prumo/core/context.md` | every type | New: the project's own rules, in `.context/`, which win over `.prumo/`. An existing project creates `.context/INDEX.md`, copies `core/context.md` from the package's `.prumo-templates/`, and points `AGENTS.md` at both indexes, saying `.context/` wins |
| `.prumo/config.json` | every type | `languages`, the project's, its base first. A config without it was generated speaking English, with its words in each component |
| `.prumo/i18n/languages.md` | every type | New, in an area every project receives: the messages, the base, and how a language is added |
| `src/i18n/locales.ts`, or `packages/i18n` in a workspace | api | New. `LOCALES`, `LOCALE_INFO`, `negotiateLocale`, `parseAcceptLanguage` and `format`. In a workspace the API imports `@app/i18n`, its TypeScript stripped by Node at runtime |
| `src/i18n/messages/` | api | New. The API's words, one file per language: every error a person reads, every mail and every text |
| `src/domain/shared/errors/domain-error.ts`, every error a person reads, `error-handler.ts` | api | A `DomainError` names its message in `text`, with `values`; `detail` is written in the request's language. An error without `text` keeps its message |
| `src/infra/http/hooks/locale.hook.ts`, `app.ts`, `fastify.d.ts` | api | New. `request.locale` from `Accept-Language`; zod writes field messages in it through `z.locales` |
| `issue-code.use-case.ts`, every use case that asks for a code, `change-email.use-case.ts`, `change-phone.use-case.ts` | api with codes | Mail and texts in the account's language, else the request's: `execute(target, purpose, { deliver, account, locale })` |
| `profile.entity.ts`, `profile.schema.ts`, `migrations/…_create_user_profile_session.ts`, `update-profile.dto.ts`, `profile-response.dto.ts` | api | `LOCALES` comes from `src/i18n/locales.ts`; a new profile speaks the device's language as the project speaks it, else the base, which is also the column's default. `Profile.localeFor` is gone |
| `link-identity.use-case.ts`, `complete-social-sign-in.use-case.ts`, `sign-in-with-id-token.use-case.ts` | api with social | An account created by a provider starts in the request's language |
| `.prumo/api/languages.md` | api | New. The request's language, the errors, mail and texts, and the deploy the package needs |
| `src/infra/mcp/mcp.scopes.ts`, `oauth.controller.ts`, `mcp.controller.ts` | api with MCP | `SCOPES` lists the scopes; how the consent page words each moves to `scopes` in the messages, in the request's language |
| `src/api-contract/auth.ts`, `profile.ts`, `index.ts`, `src/i18n/locales.ts` | web, mobile | The new account's language goes as `Accept-Language`, no longer in the body; `Locale` comes from `src/i18n/locales.ts` (`@app/i18n` in a workspace, which the contract package now depends on), and the contract no longer exports `LOCALES` |
| `src/i18n/`, `src/app.tsx`, `src/main.tsx`, `src/routes/__root.tsx`, `src/routes/_authenticated.tsx`, `src/features/i18n/`, every route and component | web on Vite | New. `I18nProvider`, `useMessages`, `rich` and `withLanguage`; every word from the messages; the switcher in the root layout; `useAccountLanguage` in the signed-in area |
| `src/features/forms/server-errors.ts` | web on Vite | `applyServerError(error, fields, setError, messages)`, for the wait it adds |
| `src/features/profile/profile-form.tsx` | web on Vite | No Locale field: the switcher sets the language, and the account follows |
| `test/support/messages.ts`, `test/support/setup.ts`, every spec | web on Vite | Tests run in the base language and find elements by its messages |
| `.prumo/client/languages.md`, `.prumo/web-vite/languages.md` | web | New |
| `src/app/[locale]/`, the root layout, every page | web on Next | Every page moves under `[locale]`, built once per language; `generateMetadata` reads `messagesOfPage(params)`; the home page names its alternates. `src/app/layout.tsx` becomes `src/app/[locale]/layout.tsx` |
| `src/proxy.ts` | web on Next | New. An address without a language goes to the chosen one (`locale` cookie), else `Accept-Language`, else the base |
| `src/i18n/`, `src/features/i18n/`, `src/features/clients/clients.tsx`, every component | web on Next | New. `I18nProvider` takes the address's language; `useMessages`, `useLocalePath`, `rich` and `withLanguage`; every link and navigation through `useLocalePath` |
| `.prumo/web-next/languages.md`, `.prumo/web-next/rendering.md`, `.prumo/web-next/structure.md` | web on Next | The routes under `[locale]`, the proxy, and the alternates |
| `.env.example`, `src/config.ts`, the root layout | web on Next | `NEXT_PUBLIC_SITE_URL`, the app's own address, which `metadataBase` resolves the alternates and canonical against |
| `src/pages/[locale]/`, `src/pages/index.astro`, `sign-in.astro`, `consent.astro`, `src/layouts/` | web on Astro | Every page moves under `[locale]`, built once per language; `/`, `/sign-in` and `/consent` become `language-redirect.astro` pages that send the browser to a language; the layout takes `locale`, sets `<html lang>`, and names the canonical and alternates whole |
| `src/i18n/`, `src/features/i18n/`, `src/features/clients/`, every island and component | web on Astro | New. `I18nProvider` takes the page's language through `island()`'s `locale`; `useMessages`, `useLocalePath`, `rich`, `withLanguage`; `choice.ts` keeps the choice; the switcher is an Astro component, no island |
| `.env.example`, `src/config.ts` | web on Astro | `PUBLIC_SITE_URL`, the app's own address |
| `.prumo/web-astro/languages.md`, `rendering.md`, `structure.md` | web on Astro | The pages under `[locale]`, the redirect pages, the switcher |
| `src/i18n/`, `src/features/i18n/`, `src/app/_layout.tsx`, `src/app/(app)/_layout.tsx`, every screen and component | mobile | New. `I18nProvider` (the app's choice, the account's, the phone's, the base), `useMessages`, `rich`, `withLanguage`; the switcher on sign-in and the profile; `useAccountLanguage` once signed in |
| `package.json`, `app.config.ts` | mobile | `expo-localization` 57.0.2, and its plugin with the project's `supportedLocales`, for the per-app language of iOS and Android 13+ |
| `src/features/forms/server-errors.ts`, `src/features/profile/profile-form.tsx` | mobile | `applyServerError(…, messages)`; no Locale field |
| `jest.config.js`, `test/support/localization.ts`, `test/support/mmkv.ts`, `test/support/messages.ts`, every spec | mobile | Tests run in the base language, with the phone naming none and MMKV in memory |
| `.prumo/mobile/languages.md` | mobile | New |

Why: making an app speak a second language means finding every word written into its code. Every project now starts
with its words in messages, so a language is added as a file and its translation.

### 0.9.0

| File | Types | Change |
|---|---|---|
| `src/infra/config/env.ts`, `src/infra/http/app.ts`, `.env.example` | api | `TRUST_PROXY`, passed to Fastify's `trustProxy`: `false` by default, `true`, or the proxies' IPs and CIDRs |
| `.prumo/api/config.md`, `.prumo/api/auth.md` | api | When to set `TRUST_PROXY`; the web and the API on one site |
| `.prumo/social/sign-in.md` | api with Apple | Register the domains the API sends mail from with Apple |
| `migrations/…_create_email_code.ts` → `…_create_one_time_code.ts`, and every file named `email-code` | api with email | `email_code` (per user) becomes `one_time_code` (per channel, destination and purpose), with the sending limits' columns. An existing project writes a migration that creates `one_time_code` and drops `email_code`: live codes are lost, and their owners ask for new ones |
| `src/domain/shared/errors/domain-error.ts`, `src/infra/http/errors/error-handler.ts` | api | A `throttled` kind answers 429, with `Retry-After` when the error carries `retryAfter` |
| `src/api-contract/api-error.ts`, `src/features/forms/server-errors.ts`, `src/features/forms/use-cooldown.ts`, `verify-email-form.tsx` | web, mobile | `ApiError.retryAfter`; a 429 says when to try again; the new-code button counts down |
| `.prumo/email/codes.md`, `.prumo/email/mailer.md` | api with email | The limits, the sweep, and a failed send answering like a sent one |
| `src/domain/users/entities/profile.entity.ts`, `create-profile.use-case.ts`, `sign-up.dto.ts`, `sign-up.use-case.ts` | api | A new profile starts in the device's `locale` and `timezone` when sign-up sends them; `Profile.localeFor` maps a tag to a supported locale |
| `src/api-contract/auth.ts` | web, mobile | `signUp` sends the device's `locale` and `timezone` |
| `.prumo/config.json` | every type | `signIn`, the ways in. A config without it was generated with `["password"]`, its `--sign-in` |
| `migrations/…_create_user_profile_session.ts`, `migrations/…_add_user_password.ts` | api | `password_hash` moves to a migration of its own, cut without `password`. An existing project's database already has the column and needs nothing |
| `src/domain/auth/entities/user.entity.ts`, `link-identity.use-case.ts` | api | `new User(email)`, then `changePassword`; `User.proveEmail` takes an unconfirmed account for whoever proved the inbox, for a provider and a code alike |
| `src/infra/http/controllers/password.controller.ts`, `auth.controller.ts` | api with password | `sign-up` and `sign-in` move out of `auth.controller.ts` |
| `src/infra/di/codes.di.ts`, `src/infra/codes/` | api with codes | `email.di.ts` becomes `codes.di.ts`; the HMAC adapter moves to `src/infra/codes/` |
| `email-code.controller.ts`, `request-sign-in-code.use-case.ts`, `sign-in-with-code.use-case.ts`, `email-sign-in.dto.ts` | api with email-code | New. `POST /api/auth/email/code` and `email/sign-in`; the purpose `sign-in` joins the `one_time_code` CHECK |
| `sign-in-choice.tsx`, `code-sign-in-form.tsx`, the sign-in route or screen | web, mobile | The sign-in page holds every way in, the code leading; the mobile `SignInForm` carries its own Sign up and Forgot links |
| `src/api-contract/auth.ts` | web, mobile | `requestSignInCode` and `signInWithCode`; `signUp` and `signIn` only with a password |
| `.prumo/api/auth.md`, `.prumo/email/codes.md`, `.prumo/social/sign-in.md` | api | A paragraph for each way in, cut from a project without it |
| `migrations/…_add_user_phone.ts`, `user.entity.ts`, `user.schema.ts`, `user.repository.ts` | api with phone-code | `email` may be null, `phone` and `phone_verified_at`, and a CHECK that one of `email` and `phone` is set. `new User({ email })` or `new User({ phone })` |
| `phone-code.controller.ts`, `request-phone-code.use-case.ts`, `sign-in-with-phone-code.use-case.ts`, `phone-*.dto.ts`, `invalid-phone.error.ts`, `phone-numbers.port.ts`, `src/infra/sms/` | api with phone-code | New. `POST /api/auth/phone/code` and `phone/sign-in`; `libphonenumber-js`; `SMS_COUNTRIES` in `env.ts` and `.env.example` |
| `text-messages.port.ts`, `log-text-messages.adapter.ts` | api with phone-code | New. The `TextMessages` port and the adapter that logs each text in a line starting `[sms] to` |
| `issue-code.use-case.ts` | api with codes | `execute({ channel, destination }, purpose, { deliver })`, mailing or texting by channel |
| `session-response.dto.ts`, `auth.controller.ts`, `src/api-contract/auth.ts` | api, web, mobile with phone-code | The session's user carries `phone`, and an `email` that may be null |
| `code-sign-in-form.tsx` | web, mobile | Asks for an email or a phone number, whichever the project signs in by, with a switch when it has both; the button reads Send me a code |
| `.prumo/codes/`, `.prumo/email/codes.md`, `.prumo/phone/` | api | The rules every code keeps move from `email/codes.md` to the new `codes/codes.md`; `phone/` is new |
| `session.entity.ts`, `require-recent-sign-in.use-case.ts`, `reauthentication-required.error.ts` | api | `Session.isRecentSignIn`: a sign-in of the last ten minutes, never by an OAuth client |
| `one_time_code.user_id`, purposes `change-email` and `change-phone` | api with codes | A code that changes an account's address is bound to it |
| `email-change.controller.ts`, `request-email-change.use-case.ts`, `change-email.use-case.ts` (and the `phone` ones) | api with email or phone codes | New. `POST /api/v1/users/me/email/code` and `/me/email` (and `/me/phone…`): a code to the new address if free, 204 either way, a notice to the old one |
| `src/api-contract/client.ts`, `src/api-contract/contact.ts`, `src/features/profile/contact-form.tsx` | web, mobile | `ApiClient.post`, and a 204 read as nothing; the profile shows each address with a way to change it |
| `review-sign-ins.port.ts`, `src/infra/review/`, `REVIEW_SIGN_IN` in `env.ts` and `.env.example` | api with a code sign-in | New. An agreed code a store reviewer enters at a named address, after asking for one there; `OneTimeCode.check` takes it as the sent one |
| `session.entity.ts`, `refresh-session.use-case.ts`, `start-session.use-case.ts`, `auth.di.ts`, `env.ts`, `.env.example` | api | The previous refresh token, after the ten-second grace, rotates the session again instead of revoking it (`rotateFromPrevious`); `SESSION_LIFETIME_DAYS`, thirty by default, replaces `SESSION_LIFETIME_MS`, injected as `SESSION_LIFETIME` |
| `delete-account.use-case.ts`, `delete-profile.use-case.ts`, `auth.controller.ts`, the user and profile repositories | api | New. `DELETE /api/auth/account` after a recent sign-in; the profile, then the user, whose rows the database removes with it |
| `src/api-contract/auth.ts`, `src/features/profile/delete-account.tsx`, the profile page or screen | web, mobile | `deleteAccount()`, and a Delete account that asks twice |
| `social-sign-in.entity.ts`, `social-sign-in.schema.ts`, `migrations/…_create_identity_social_sign_in.ts`, `identity-providers.port.ts`, `openid-identity-providers.adapter.ts`, `identity.repository.ts` | api with social | `social_sign_in.intent`, `sign-in` or `delete`; `IdentityProviders.revoke`, which revokes the token a code yields where the provider asks it (Apple); `IdentityRepository.findByUser`. An existing project writes a migration that adds `"intent" text not null default 'sign-in'` |
| `start-account-deletion.use-case.ts`, `resume-account-deletion.use-case.ts`, `provider-confirmation-required.error.ts`, `delete-account.use-case.ts`, `complete-social-sign-in.use-case.ts`, `social.controller.ts` | api with Apple | New. Deleting an account that signs in with Apple answers 409 `provider_confirmation_required`; `POST` and `GET /api/auth/social/apple/deletion` take the browser to Apple, and the callback revokes the token and deletes the account |
| `src/api-contract/auth.ts`, `delete-account.tsx`, `social-buttons.tsx`, the sign-in route | web, mobile with Apple | `accountDeletionUrl`; Continue with Apple when the deletion answers 409; Your account was deleted on the way back |
| `.prumo/social/sign-in.md`, `.prumo/api/auth.md` | api with Apple | The deletion through Apple |
| `identity-providers.port.ts`, `openid-identity-providers.adapter.ts`, `sign-in-with-id-token.use-case.ts`, `social.controller.ts` | api with social | `IdentityProviders.isNativeConfigured`, `verify` and `revokeNative`; `POST /api/auth/social/<provider>/token` signs in with the ID token a provider's own sheet gave the app, checked with `jose` |
| `issue-native-nonce.use-case.ts`, `delete-account-with-id-token.use-case.ts`, `delete-account.use-case.ts`, `env.ts`, `.env.example` | api with Apple | New. `POST /api/auth/social/apple/nonce`, `apple/deletion/nonce` and `apple/deletion/token`; `APPLE_BUNDLE_ID`, the iOS app's bundle identifier, which Apple's sheet issues tokens to |
| `src/api-contract/auth.ts` | web, mobile with social | `signInWithIdToken`; with Apple, `appleNonce` and `deleteAccountWithApple` |
| `src/features/auth/native-sign-in.ts`, `social-buttons.tsx`, `delete-account.tsx`, `src/config.ts`, `app.config.ts`, `.env.example`, `package.json` | mobile with social | New. Apple's sheet on iOS (`expo-apple-authentication` 57.0.2, and its plugin); Google's sheet (`@react-native-google-signin/google-signin` 16.1.5) once `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` are set, its plugin added by `app.config.ts`; the browser otherwise |
| `jest.config.js`, `test/support/google-sign-in.ts` | mobile with Google | New. A stand-in for Google's native module, loaded before every test |
| `.prumo/social/sign-in.md`, `.prumo/mobile/config.md`, `.prumo/core/testing.md` | api, mobile with social | The sheets, their ids, and the stand-in |
| `test/support/test-app.ts`, `test/support/fakes/auth-fakes.ts` | api | `signIn` and `signedIn` reach a session through the project's own way in; `signUpWithPassword` and `register` stay for the password's own specs |

Why: behind a load balancer every client shared the balancer's address, so the rate limits put the whole world in
one bucket of ten sign-ins a minute.

Why, for the ways in: a project could not be generated without passwords, and a code that creates the account on
first use is what many products want instead. A project that wants to add sign-in by code generates a reference with
`--sign-in password,email-code` and carries the email-code files over.

Why, for the sheets: a phone signs in with the account it already holds, without leaving the app. The browser stays
for Apple on Android, and for Google until the app is registered with it.

Why, for Apple's deletion: Apple asks an app with Sign in with Apple to revoke the user's tokens when it deletes the
account. A fresh sign-in gives the token to revoke, so none is kept for the account's life.

Why, for the codes: the per-IP limits let one address be sent a code every few seconds from many IPs, filling a
mailbox; with a phone, every text costs money. And a code was keyed by its user, so none could exist before the
account, which a sign-in by code needs.

### 0.8.2

| File | Types | Change |
|---|---|---|
| `vite.config.ts`, `vitest.config.mts` | web | `testTimeout: 15_000` |

Why: a web app's form tests crossed Vitest's 5-second default on a slow machine, Windows CI among them, while the
same suite passed alone.

### 0.8.1

| File | Types | Change |
|---|---|---|
| `package.json` | api | `start:dev` passes `--env-file-if-exists=.env`, so `node --watch` restarts the API when `.env` changes |
| `.prumo/api/config.md` | api | Says why |

Why: moving a web app to a free port writes its new origin into the API's `WEB_ORIGIN`, but an API already running
kept the old list and refused the app's requests until it was restarted. The web apps already restarted on a
changed `.env`.

### 0.8.0

**`site` is gone; a web app names its framework.** `web` is one type built with Vite (the default), Next or Astro,
chosen with `web:<framework>` in `--types`, `--app` and `prumo add`, and asked in a terminal. `--types site` is refused.

| File | Types | Change |
|---|---|---|
| `.prumo/config.json` | every type | `apps` is written for every project, a web app with its `framework` |
| `.prumo/web/` | web | Holds only `components.md`, which is every web app's. `routing.md` and `structure.md` moved to `.prumo/web-vite/` |
| `.prumo/web-next/`, `.prumo/web-astro/` | web on Next or Astro | New areas. `web-next` replaces `.prumo/site/`, rewritten for a public side and a signed-in side |
| `.prumo/client/data.md`, `.prumo/core/tooling.md`, `.prumo/monorepo/*.md`, `.prumo/multi-tenancy/client.md` | every type | Name the frameworks instead of `site` |
| `scripts/ports.mjs` | every type, and the workspace root | Knows each app by the template it came from, so a web app's port starts from its framework's: Vite 5173, Next 3200, Astro 4321 |
| `package.json`, `README.md` | every type, and the workspace root | `engines.node` rises to `>=22.23.4`, which Astro 7 requires, for every project |
| `.env.example` | api | `WEB_ORIGIN` lists every web app, whatever its framework |

**A 0.7 `site` has no reference to diff against.** Generated with `--types web:next`, the app is the old site's public
page plus the sign-in, the signed-in area and MCP consent of a Vite web app, with the API contract: keep the site's
pages and carry `src/features/`, `src/components/ui/`, `src/api-contract/`, `src/app/(auth)/`, `src/app/(signed-in)/`
and the test support over from the reference, then add the app's origin to the API's `WEB_ORIGIN`. Its port moves
from `SITE_PORT` to `WEB_PORT`, and its API address is `NEXT_PUBLIC_API_URL`.

Why: a site was often the whole web app and needed search engines and a sign-in at once, which neither type gave.

### 0.7.0

| File | Types | Change |
|---|---|---|
| `.prumo/core/git.md` | every type | New. The branch flow: `task/`, `fix/`, `chore/`, `docs/`, `refactor/` → `dev` → `staging` → `main`, and large work through `project/` |
| `.prumo/INDEX.md` | every type | Lists `core/git.md` |
| `.github/workflows/flow.yml` | every type, at the root | New. Fails a pull request that skips a step of the flow |
| `.github/rulesets/flow.json`, `.github/rulesets/project.json` | every type, at the root | New. What the README's `gh api` commands send to make the check required |
| `README.md` | every type, at the root | A Branches section with those commands |
| `.githooks/pre-commit` | every type, at the root | `--no-errors-on-unmatched`, so a commit of only files Biome does not check passes |
| `.prumo/core/tooling.md` | every type | Names that flag |

Why: with several people on one project, a large change merged into `dev` early decided what shipped next for
everyone. A `project/` branch holds it, split into tasks, until it is decided to ship. A new project's repository
also starts on `main`, whatever the machine's `init.defaultBranch` says; an existing one renames its branch with
`git branch -m main` if it needs to.

### 0.6.1

Nothing generated changed. Three fixes to `prumo add`, each found once it ran with a real install:

- on Windows it failed after installing, because it passed the new app's path to Biome with backslashes;
- where `CI` is set, pnpm refused to update the lockfile the new app changes;
- a first web app had its origin listed twice in the API's `WEB_ORIGIN`. A project 0.6.0 gave a doubled origin
  works as it is.

### 0.6.0

| File | Types | Change |
|---|---|---|
| `src/infra/config/env.ts` | api | `WEB_ORIGIN` is a comma-separated list of origins, parsed into an array; one origin is a list of one |
| `src/infra/http/hooks/origin.hook.ts`, `src/infra/http/app.ts` | api | The origin check and CORS accept every origin in the list |
| `src/infra/http/controllers/oauth.controller.ts` | api | MCP consent opens on the first origin |
| `src/infra/http/controllers/social.controller.ts` | api | Takes an optional `origin`, refused unless trusted, and sends the web back to it |
| `test/support/setup.ts`, `test/infra/config/env.spec.ts`, two controller specs | api | `WEB_ORIGIN` as an array; new cases for several web apps |
| `.env.example`, `README.md` | api | Say that `WEB_ORIGIN` is a list |
| `src/api-contract/auth.ts`, or `packages/api-contract/src/auth.ts` | web, mobile | `socialSignInUrl` takes an optional `origin` |
| `src/features/auth/social-buttons.tsx` and its spec | web | Pass `window.location.origin` |
| `scripts/ports.mjs` | every type, and the workspace root | Finds the apps through `.prumo/config.json`, and keys its result by app name |
| `.prumo/monorepo/*.md`, `.prumo/api/auth.md`, `.prumo/social/sign-in.md`, `.prumo/mcp/server.md` | workspace, api | Apps named on purpose, and several web apps |
| `src/infra/social/openid-identity-providers.adapter.ts` | api | Without Apple, the `jose` import goes with it |

Why: a workspace may hold apps named on purpose, and more than one web or site, through `prumo new --app
<name>=<type>` or, later, `prumo add <type> [name]`. `prumo add` works only from the version that generated the
project, so a project from before 0.6.0 does not take it. `.prumo/config.json` lists them in `apps`, which a workspace from an older version lacks; without
it, `ports.mjs` reads one app per type, named after it, as before. Nothing else changes for a project that keeps its
default names, and a single `WEB_ORIGIN` keeps working.

### 0.5.1

| File | Types | Change |
|---|---|---|
| `test/support/query-client.ts` | web, mobile | New. `createTestQueryClient()` builds a test's `QueryClient` with `retry: false` and `gcTime: Infinity` |
| Every spec that builds a `QueryClient`, and web's `test/support/render-app.tsx` | web, mobile | Build it with `createTestQueryClient()` instead of `new QueryClient()` |
| `.prumo/core/testing.md` | every type | The rule names the helper instead of the option to remember |

Why: a query or mutation left without an observer starts a five-minute timer, and Jest's worker waits on it until
it is force-exited. 0.4.2 fixed one mobile spec; the helper fixes every test that will be written.

`prumo new` also refuses a name pnpm's compatibility database extends, such as `ws`. Nothing in a project changes,
but a project already named that way installs packages it never asked for: renaming the root `package.json` stops it.

### 0.5.0

| File | Types | Change |
|---|---|---|
| `.gitattributes` | every type, at the root | New. `* text=auto eol=lf` |
| `scripts/ports.mjs` | every type, and the workspace root | Largely rewritten |
| `scripts/database.mjs` | api | Migrates through the shell |
| `README.md` | api, workspace | States the Windows requirements |

Why: Prumo and its projects run natively on Windows from 0.5.0. `.gitattributes` keeps a Windows checkout in LF,
which Biome would otherwise flag in every file. `ports.mjs` finds and stops a port's holders on Windows, and it
also fixes macOS and Linux: an app's processes now stop when what started them is gone, so a Ctrl+C soon after
`pnpm dev` no longer leaves apps running with their ports held. `database.mjs` runs `pnpm db:migrate` through the
shell, which is how Node starts pnpm's shim on Windows. `prumo clean` removes `database.mjs` once the database
exists, and only when the file is still the one its version shipped: a project already cleaned has nothing to
change there, and one that copies the new file deletes it by hand when the database exists.

### 0.4.3

Nothing generated changed. `prumo new` without a terminal refuses a single type given neither `--alone` nor
`--monorepo`.

### 0.4.2

| File | Types | Change |
|---|---|---|
| `migrations/package.json` | api | New. `{ "type": "module" }` |
| `test/support/global-setup.ts` | api | `teardown` stops the container only when one started |
| `test/features/profile/profile-form.spec.tsx` | mobile | Its `QueryClient` sets `mutations.gcTime` to `Infinity`; 0.5.1 replaces this with the helper |
| `.prumo/database/migrations.md`, `.prumo/core/testing.md` | api, every type | Say why, in the two rules above |

Why: Node loads the migrations as TypeScript by type stripping and, with no module type declared, warned
`MODULE_TYPELESS_PACKAGE_JSON` in every test worker. When the Postgres image could not be pulled, the teardown
threw a second error over the one that mattered. And the mobile profile test left a timer that made Jest
force-exit its worker.

### 0.4.1

| File | Types | Change |
|---|---|---|
| `package.json` | mobile | Adds `expo-dev-client`; `ios` and `android` run `expo run:ios` and `expo run:android` through `ports.mjs` |
| `README.md` | api, web, mobile, workspace | Says what email, social sign-in and MCP change, and how the mobile app runs |

Why: the mobile app runs in a development build instead of Expo Go. This one is a choice, not a fix: a project
happy with Expo Go can stay on it.

### 0.4.0 and 0.3.0

Not a matter of copying files. 0.3.0 replaced Better Auth with the API's own authentication, and 0.4.0 added
email verification, password reset, social sign-in and MCP scopes, each across the API and its clients. A
project generated before either keeps what it has; to adopt one, generate a reference with the feature and port
it as you would any feature, with the reference as the example.

### 0.2.0

| File | Types | Change |
|---|---|---|
| `package.json` | api, web, mobile | `better-auth`, every `@better-auth/*` package and the api's `auth` from 1.7.6 to 1.7.7, adding `@better-auth/core` |
| `package.json` | every type | `engines.node` rises to `>=22.18.0` |

Why: Better Auth 1.7.7 fixes a critical advisory present in 1.7.6. A project from 0.1.x still on Better Auth
should take this one, or a later release of Better Auth.
