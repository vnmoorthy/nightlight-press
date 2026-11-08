## What this changes

<!-- One or two sentences. Link the issue: "Closes #123". -->

## Why

<!-- The problem it solves, for a child, a parent, or someone running their own company. -->

## How I tested it

<!-- Local run, a book you made, the ledger lines you saw, screenshots for anything visual. -->

## Checklist

- [ ] `node --check` passes on every file in `app/src` and `app/public/js`, and `node gen-prompts.mjs` and `node build.mjs` run (CI does this too)
- [ ] Models write, code decides: anything about safety, money or who gets contacted lives in code
- [ ] No child-safety control is weakened (Editor checks, grown-up gates, consent, AI disclosure, the choice to leave Pip out, opt-in public posting)
- [ ] New consequences are written to the ledger, with no secrets or full personal details in `detail`
- [ ] No keys, tokens or real children's details anywhere in the diff
- [ ] Any new environment variable is added (name and comment, no value) to `.env.example` or `app/.env.example`
- [ ] Any timing or cost I quote comes from a real run
- [ ] README, docs and CHANGELOG updated if behaviour changed
