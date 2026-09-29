# Layout

## Rule

Put deployable things in `apps/` and shared code in `packages/`.

Name an app directory after its type (`apps/api`, `apps/web`, `apps/mobile`, `apps/site`), never after
the product.

Keep one package from the start: the integration layer between the clients and the API. It holds URL
construction, the `ApiError` parsing, the hand-written contract types and the query factories.

**Let each app inject its own transport.** The package does not perform the fetch.

Ship the package as TypeScript source. Do not build it to `dist/`, and do not give it a build step.

Create a second package only when **two apps consume it**. While one app uses it, keep it inside that app.

Name a package for what it does. **Never `shared`, `common` or `utils`.**

Resolve `@/` to each app's own `src/`. Import a package by its name.

## Rationale

An app and a package have different lives. An app has a deploy, environment variables, a version in a
store; a package has none of that and exists because something imports it. One directory for both erases a
distinction that reappears in every later decision: what CI builds, what a filter reaches, what has a
Dockerfile.

The integration package exists because the rest of the sharing was already refused: contract types are
hand-written rather than generated, validation differs on each side, and shadcn copies components rather
than sharing them. What genuinely repeats across clients is how a URL is built, how an error body becomes
an `ApiError`, and what the contract's shapes are. Only transport differs (the web sends its cookie
automatically, mobile attaches it from secure storage, a site's server calls anonymously), so transport
comes from outside.

**This is also what recovers most of what hand-written types gave up.** That decision accepted, as its
cost, that a renamed field leaves each client compiling against its own copy. One copy instead of three
does not remove drift from the server; it stops it multiplying, and makes fixing it one place. The package
describes the **wire shape** (what the JSON carries), not an entity whose excluded fields are absent from
it.

Source rather than a build, because a built package needs a mandatory build order and, without a watcher,
produces the standard monorepo failure: changing the package and not seeing the effect. Editing a type and
seeing the error immediately is what makes sharing better than copying.

Two consumers, because one is evidence of nothing, and extracting early into a package costs more than
extracting early into a component. A name, because `shared` cannot grow wrongly only by never being able to
grow rightly: anything fits inside it.

## Applies to

The workspace root and everything under it.

## Examples

Layout:

```
✅  apps/api  apps/web  packages/api-contract
❌  apps/acme-backend  packages/shared
```

The package's boundary:

```
✅  createClient({ fetch: myTransport })
❌  the package calling fetch and reading a cookie itself
```

## Enforcement

**Review only.** That a new package has two consumers and a real name, and that nothing crept into a
`shared` directory under another spelling.

**Two things worth knowing:**

**Moving a file between apps calls for checking its imports.** `@/` means something different in each app,
so a file moved to the same path in another app can compile while pointing elsewhere. That only happens
with generic code, which is the code that belonged in the package.

**A Vite app and a Next app consume the package as source with no configuration**: Next 16 needs no
`transpilePackages`; a page importing it builds, stays static, and renders the imported value. Its `exports` points at `src/index.ts`,
`tsc` with `moduleResolution: bundler` typechecks through it, and `vite build` bundles it, verified in a composed
workspace. The API does not import the package, so its SWC build never compiles it.

**Expo resolves workspace packages automatically from SDK 52**, with no `watchFolders` or
`nodeModulesPaths` configuration. Older guidance about configuring Metro by hand no longer applies. Verified with
SDK 57: Metro bundles `@app/api-contract` as source, and Jest with `jest-expo` resolves it the same way.
