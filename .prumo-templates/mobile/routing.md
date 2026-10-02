# Routing

## Rule

Hold the native splash screen until the session has been read, with the tokens from `expo-secure-store`. Only then let the
router render the authenticated group or redirect to login.

Express protection with an authenticated layout group. Do not check for a session inside a screen.

**In that layout, render nothing while the session is pending.** Redirect to sign in only once it has arrived
empty or failed to load.

When a deep link targets a protected route without a session, keep the intended destination **in memory**
and navigate to it after a successful login. Do not persist it.

Enable `experiments.typedRoutes`. Use absolute paths in every navigation.

Let the navigation shape (how many tabs, which stacks) follow the product. It is not a convention.

## Rationale

On the web the cookie travels with every request and the server decides, so the client is never in doubt.
On mobile the session lives in secure storage and reading it is asynchronous, so every cold start has a
moment where nothing is known yet.

**MMKV persists across launches, which makes that moment dangerous rather than merely untidy.** A
protected screen rendering before the decision can show cached data from the **previous user** for a
fraction of a second. Holding the splash costs nothing in perception (it is already a native, expected
moment) while the alternative flash reads as a defect and can show somebody else's data.

Checking inside each screen fails differently: the screen written tomorrow does not check.

**A pending session is not a missing one.** The natural check, redirect when there is no session data, works
at a cold start only because the splash holds rendering until the session arrives, so the layout never sees
it pending. Signing out empties the query cache, and the next sign-in mounts the layout with the session still
on its way: the check reads no data, and sends the person who just signed in straight back to sign in. Nothing
in normal use shows it until somebody signs out. Waiting while pending must not become a way in either, so a
session that failed to load redirects just like an empty one.

A dropped deep-link destination is the most common reason a notification link "does not work": the person
taps a specific order, signs in, and lands on the home screen with the order to find by hand. Keeping the
destination in memory rather than on disk matters because `orders/123` describes intent: it says the order
exists and that this person wanted it. That value is useful for seconds and should not outlive the
process. Somebody who closed the app midway through login is not returning expecting to resume.

Typed routes are beta, and are enabled because the gain is correctness rather than appearance: a wrong
`href` is broken navigation, not an untidy string. The web app gained end-to-end route typing from its own
router; without this, the same typo compiles here and fails there.

## Applies to

Every file under `app/`, and the bootstrap that controls the splash.

## Examples

Protection:

```
✅  app/(app)/_layout.tsx        → resolves the session, then renders or redirects
    app/(app)/orders.tsx
❌  app/orders.tsx               → if (!session) router.replace('/login')
```

Deciding in the layout:

```
✅  if (session.isPending) return null
    if (session.data === null || session.data === undefined) return <Redirect href="/sign-in" />
❌  if (!session.data) return <Redirect href="/sign-in" />
    // bounces the next sign-in back once the cache has been cleared
```

Navigation:

```
✅  router.push('/orders/123')
❌  router.push('../orders/123')   // relative paths are not typed
```

## Enforcement

**Structural.** A screen inside the authenticated group cannot skip the check, because the layout resolves
before it renders.

**Compiler.** Typed routes reject a misspelled path and a missing or wrongly typed param.

**Tests.** Render the router with an empty cache and three session answers: one that arrives late expects
the protected screen, an empty one and a failed one expect sign in. Rendering with a session already cached
passes with the defect in place.

**Review only.** That the splash is released only after the session resolves, and that a deep-link
destination is not written to storage.

**An asymmetry with the web area, recorded so nobody corrects it:** there, the generated route tree is
committed, because without it a clean clone does not typecheck. Here `expo-env.d.ts` is generated and
gitignored, which is Expo's own convention. That file is the framework's territory, and fighting its
default `.gitignore` creates friction on every upgrade.
