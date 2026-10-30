# Project rules

## Rule

Keep the rules that are this project's own in `.context/`, at its root: one file per subject, in the shape every
document of `.prumo/` has, a title and then **Rule**, **Rationale**, **Applies to**, **Examples** and
**Enforcement**. Group the files in folders by subject, named as the project names things
(`.context/billing/invoices.md`). List every file in `.context/INDEX.md`, as
`- [billing/invoices.md](billing/invoices.md): Invoices`, in the same change that writes it.

**Where `.context/` and `.prumo/` disagree, `.context/` wins.** A rule that replaces one of `.prumo/` names the file
it replaces, and why, in its Rationale.

Write a rule there, without asking, when the developer states one that outlasts the task at hand:

- they say *always*, *never*, *from now on*, or the like;
- they decide how this project does something: a library, a name, a flow, a limit;
- they correct something you would need to know next time.

Say in your reply that you wrote it, naming the file, so they can correct it. A rule you only inferred, from the code
or a pattern you noticed, is a proposal: write it once the developer agrees.

Before writing, find the file that already covers the subject, and change it rather than adding a second one.
Do not write what only the task at hand needs, what the code already says plainly, or what `.prumo/` already says.

## Rationale

`.prumo/` holds what Prumo knows about every project of its kind. What this project decides for itself, its domain,
its exceptions, its team's choices, is known only to whoever was in the conversation, and it is lost when the
conversation ends. Written where every assistant reads it, it holds in the next session and for the next person.

It wins because it is the more specific: a rule of `.prumo/` was written without this project in view, and a rule of
`.context/` for it.

What the developer said is written without asking again, because asking again is the burden this saves. What an
assistant only deduced is not: a wrong guess, once written, becomes the project's rule.

## Applies to

Every file in `.context/`, and every conversation in which the developer says how this project works.

## Examples

```
Developer: "Invoices are always issued in the customer's currency, never converted."
✅  .context/billing/invoices.md, listed in .context/INDEX.md, and the reply names it
❌  Following it in this change only, and losing it when the conversation ends
```

```
✅  .context/api/errors.md, Rationale: "Replaces .prumo/api/errors.md: our clients read `code`, not `detail`."
❌  A second file on errors beside the first, saying something else
```

```
You notice every use case here logs its input.
✅  "Every use case logs its input. Should I write that down as a rule in .context/?"
❌  Writing it down unasked
```

## Enforcement

**Review only.** That a rule went into `.context/` when the developer stated it, into the file that already covered
its subject, and into the index.
