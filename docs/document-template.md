# The document template

The shape every document under `.prumo/` fills. Settled in step 0.3 on 2026-09-10.

**One template, for everything.** There is no second shape. The consistency is the product: an
assistant that can rely on the form stops spending attention on it.

---

## The shape

```markdown
# <Title>

## Rule

<the rule, in the imperative>

## Rationale

<why, one short paragraph>

## Applies to

<where this bites, in prose>

## Examples

✅ <correct>
❌ <incorrect>

## Enforcement

<lint rule, CI check, or "review only">
```

**No frontmatter.** Nothing was left to put in it: `reviewed:` measures attention rather than truth,
and `applies-to:` globs would describe a source layout that does not exist yet. `scope:` would say
what *Applies to* already says.

---

## The five sections

| Section | Does |
|---|---|
| **Rule** | States the obligation. Imperative, always. |
| **Rationale** | Gives the reason. A rule without one is misapplied at the edges, and an assistant needs the why to generalise correctly. |
| **Applies to** | Says where the rule bites, in prose. "Every entity class" is more robust than a glob, because it does not depend on a path. |
| **Examples** | ✅ / ❌ contrast. The highest yield per line for a reader that is a machine. |
| **Enforcement** | Names what verifies the rule, or admits **review only**. |

**Enforcement earns its place by being uncomfortable.** It forces the writer to admit when nothing
checks a rule. A repository that has already found two checks lying and one rule that never fired has
reason to make that explicit rather than leave it implied.

---

## Voice

The **Rule** section is imperative. Other sections use whatever voice fits.

Hedging words do not appear in a Rule: *should*, *generally*, *prefer*, *usually*. They grant explicit
permission not to comply. An assistant reading *tables should generally have `tenant_id`* is
authorised by the sentence itself to create one without.

**An exception is stated by name, never hedged.**

```
✅  Every table has tenant_id, except user, session and organization.
❌  Tables generally have a tenant id.
```

The second is false and permissive at once: it hides the exception and dissolves the rule in the same
breath.

---

## Code in a document

Examples show **form**, never a program. The test:

> Could this be copied into a file and run?

If yes, it is too much. What rots is code that **claims to work**, because it carries imports, versions and
API signatures, and all of those change underneath it without warning. A fragment of shape claims
none of that and depends on nothing:

```
✅  name!: string
❌  name: string
```

When running code genuinely needs to be shown, the answer is not *make it shorter*. It is *this
belongs somewhere a compiler looks at it*.

---

## How many documents, and how long

**One file per subject**, where a subject is settled by a test: *would an assistant ever need this
without the rest?* If no, the two subjects are one file.

**No line budget.** A limit on a document is a workaround waiting to happen, because whoever exceeds it
splits the subject to fit, producing two documents only ever read together, which is what the subject
test exists to prevent.

A document that ends up with three one-line sections is a signal it should be merged with another.
A document that grows very large is a signal the subject was badly separated. Both are symptoms to
act on, not infractions to report.

**Age comes from git.** Documents carry no review date; `git log -1 --format=%cs <file>` answers when
one last changed, and cannot lie about it.
