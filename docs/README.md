<img src="https://raw.githubusercontent.com/stjosephworks/prumo/main/docs/brand/icon.png" alt="" width="28" align="left">

# Prumo's own documents

These describe **how Prumo is built**. None of them ships to a generated project. What ships is the
`.prumo/` folder, whose layout is in [`structure.md`](structure.md) and whose contents are the
knowledge base in `.prumo-templates/`.

| Document | Holds |
|---|---|
| [`stack.md`](stack.md) | What is locked: structural rules, installed packages, version floors, and what was deliberately dropped |
| [`structure.md`](structure.md) | The `.prumo/` layout a generated project receives: areas, inclusion rule, file naming, the index |
| [`document-template.md`](document-template.md) | The shape every document fills: five sections, voice, how much code, how many files |
| [`maintaining-templates.md`](maintaining-templates.md) | How a template is changed, how a change is proved, and the steps a regeneration undoes |
| [`upgrading.md`](upgrading.md) | For a project's owner: what each release changed in the files it generates, and how to carry it over |

Each of them states what is in force. How any of it came to be decided is not here: that history is in
`dev-logs/`, which nothing in this folder references and nobody has to read.
