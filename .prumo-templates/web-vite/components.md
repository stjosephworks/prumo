# Components

## Rule

Edit a shadcn component in place. Do not wrap it, and do not keep a parallel component around it.

Extract a repeated Tailwind class list on its **third** occurrence, and extract it as a component, never
as a string constant.

Express variants with `cva`, in every component, including ones that did not come from shadcn.

Do not sort classes automatically, and do not add a Prettier plugin to do it.

Components are built on Base UI. **Change the rendered element with the `render` prop, never `asChild`.** Pass
`nativeButton={false}` when a button renders something that is not a `<button>`.

## Rationale

shadcn copies files into the project rather than shipping a dependency, so the component is yours to edit.
Wrapping instead would produce a parallel set (a `Button` around `ui/Button`), and then every screen has
to know which to import; half will import the wrong one, and the wrapper stops applying exactly where it
mattered.

The third occurrence is the threshold because the second is often not a repetition: two things that look
alike today and diverge next week. Extracting then couples them, and the next change needs a prop to tell
them apart. A number is arbitrary, and having one stops two developers and an assistant from each using a
different threshold. A component rather than a string constant, because a constant shares appearance
without structure: every site still writes its own wrapper, and there is nowhere to put the extra one
when it is needed.

`cva` is already present and already how every installed component is written. Using conditionals
alongside it would leave two variant grammars in one project, divided by where a file came from, a
boundary made of history rather than nature. It also declares the combinations, so TypeScript knows which
values exist and a typo does not compile, where a concatenated string lets two conflicting variants
coexist and the last class win by accident.

**`render`, because `asChild` does not exist here** and is what almost every tutorial and every assistant's
training shows: shadcn ran on Radix for years. The compiler rejects `asChild` on these components, and that is
where the real risk starts: an assistant meeting the error tends to satisfy it the wrong way, by dropping the
`Button` for a styled `Link` or by wrapping it. Base UI's own documentation states the difference in one line:
Radix uses `asChild`, Base UI uses `render`.

Class order in the attribute changes nothing: Tailwind generates the CSS in its own order, so sorting is
cosmetic. Biome's rule for it is experimental, its fix is classified unsafe and therefore does not run in
the pre-commit hook, and it does not yet handle screen variants or plugin utilities.

## Applies to

Every component under `src/`.

## Examples

Changing a primitive:

```
✅  edit components/ui/button.tsx
❌  components/button.tsx exporting a wrapper around ui/Button
```

Extraction:

```
✅  third time the same list appears → <Card> component
❌  second time → const cardClasses = "flex items-center gap-2 …"
```

Rendering a link as a button:

```
✅  <Button render={<Link to="/sign-up" />} nativeButton={false}>Sign up</Button>
❌  <Button asChild><Link to="/sign-up">Sign up</Link></Button>     // Radix's idiom
```

Variants:

```
✅  cva('inline-flex …', { variants: { size: { sm: …, lg: … } } })
❌  className={`inline-flex ${size === 'sm' ? 'h-8' : 'h-10'} ${tone}`}
```

## Enforcement

**Compiler.** `cva` makes variant names typed, so a misspelled variant does not build. `asChild` on a Base UI
component does not build either.

**Review only.** That a third repetition was extracted, and that nobody wrapped a shadcn primitive instead
of editing it.

**Two things to know rather than discover:**

`cn` is imported from the npm package **`cn`**, published by shadcn, which the CLI now installs in place of
`clsx` and `tailwind-merge`. Code importing either of those is copied from older material.

Biome's recommended preset rejects two things in generated primitives that are correct there (a label that
receives `htmlFor` through props, and `role="group"` on a field), so those two rules are off for
`components/ui/` only, as `core/tooling.md` records. Anything else it reports in generated code is fixed in
place.

`shadcn init` can stop on an interactive prompt even with `-y`. Pass every choice as a flag
(`shadcn init -b base -p nova --no-monorepo -y`) rather than waiting on it.

Re-running the shadcn CLI for a component **overwrites** your edits: it neither versions nor merges.
Reinstalling one is a deliberate act with the diff inspected, not part of updating dependencies.

Automatic class sorting is worth revisiting when Biome's `useSortedClasses` leaves the nursery group and
its fix becomes safe. It then runs inside the existing hook with nothing else changing.
