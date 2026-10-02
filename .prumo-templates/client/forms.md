# Forms

## Rule

Keep a form's Zod schema in its feature, beside the component. Derive the request type from it with
`z.infer` where the shapes match. Where they differ, let the schema describe the **form** and write an
explicit function that builds the request.

Configure `useForm` with `mode: 'onTouched'` and `reValidateMode: 'onChange'`.

On a failed submission, walk the `errors` map from the `ApiError` and call `setError` on each matching
field. **Turn anything that matches no field into a form-level error**, shown at the top with the
`requestId`. Do it through one function in `features/forms/`, which sets the form-level error on
`root.server`.

Show an error carrying no field the same way: form-level, with `title` and the `requestId`. A wrong password
is this case: the API names no field, so as not to say whether the email exists.

Disable the submit button while `isSubmitting`. Never clear the form on error.

## Rationale

Client types are written by hand and a form already carries a schema, so declaring both separately would
be two declarations of one fact. `z.infer` removes the second wherever the shapes agree, and the explicit
transform keeps the difference visible where they do not.

**A form's schema is not the server's validation.** The API validates its own input and trusts no client;
this schema exists for immediate feedback. When the two disagree, the server wins, which is why unmatched
errors must surface rather than vanish.

That is the hole the mapping rule exists for. The server can reject a field this form does not have,
because its rules changed or the validation is business rather than shape. Walking only the form's own
fields makes that disappear: the user presses save, nothing happens, nothing is shown. A button that does
nothing is the most frustrating failure there is and leaves support nothing to work from.

One function rather than a loop in each form, because the loop is where the silent failure lives, and three
copies of it diverge. `root.server` is react-hook-form's place for an error belonging to no field, so it is not
cleared when a field revalidates.

`onTouched` separates two moments that look like one. Before a field has errored the user is not
interrupted; after it has, they are correcting and want to know when it is right. `onChange` alone turns
a field red while someone is still typing; `onSubmit` alone reports the third field's problem after twelve
have been filled.

Disabling the button prevents the most common cause of duplicate records. Preserving the form on error
prevents losing twelve fields of typing over a problem that was not the user's.

## Applies to

Every form, in every client.

## Examples

Schema as the source of the type:

```
✅  const schema = z.object({ email: z.email() })
    type CreateUser = z.infer<typeof schema>
❌  const schema = z.object({ email: z.email() })
    type CreateUser = { email: string }
```

Mapping the response:

```
✅  for (const [field, messages] of Object.entries(err.errors))
      isKnown(field) ? setError(field, …) : addFormError(messages)
❌  for (const field of Object.keys(form.getValues()))
      if (err.errors[field]) setError(field, …)     // unknown fields vanish
```

Submission:

```
✅  <button disabled={isSubmitting}>
❌  <button>                       // a double click creates two records
```

## Enforcement

**The form library.** `isSubmitting` and the validation modes are configuration, not code that can drift
per form.

**A test, where one exists.** Rendering the form against a fake transport that returns `400` with an
`errors` map, and asserting the message appears **inside that field**, fails the moment the mapping breaks.

**Review only.** That unmatched field errors are surfaced rather than dropped; the failure is silent and
looks like a button that does nothing. And that a form is not reset in an error branch.
