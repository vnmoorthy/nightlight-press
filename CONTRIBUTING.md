# Contributing to Nightlight Press

Thanks for wanting to help a company with no employees. This guide covers local setup, how the job queue works, how to add a desk, and the house style.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Security problems go through [SECURITY.md](SECURITY.md), never a public issue.

## Dev setup

You need Node.js 20+, Docker (or any recent Postgres), and whichever sponsor keys the desks you are working on use. The full walkthrough is [docs/QUICKSTART.md](docs/QUICKSTART.md).

```bash
git clone https://github.com/vnmoorthy/nightlight-press
cd nightlight-press
cp .env.example .env                 # sponsor keys, never committed
cp app/.env.example app/.env.local   # DATABASE_URL and local settings, never committed
docker run -d --name nightlight-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=nightlight postgres:16
cd app && npm i && ./dev.sh          # http://localhost:3100
```

`dev.sh` compiles `prompts/*.md`, the SQL migrations and the fonts into `app/src/prompts.generated.js` (gitignored), then runs the server with `--watch-path=./src`. Migrations apply on boot. A local clock ticks the queue every 3 seconds (`TICK_SECONDS`).

Before you open a pull request, run what CI runs:

```bash
cd app
npm ci
find src public/js -name '*.js' -print0 | xargs -0 -n1 node --check
node gen-prompts.mjs
node build.mjs
```

## How the queue works

Everything the company does is a row in one Postgres `jobs` table (`app/src/jobs.js`). Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full picture; the short version:

- **`enqueue(kind, { order_id, book_id, page_id, payload, delayMs })`** inserts a job.
- **`claim()`** takes the next due job with a lease (40 seconds; 180 for binding, delivery and marketing), using `for update skip locked`, so any number of workers can tick at once without taking the same job.
- **`tick()`** in `app/src/engine.js` claims and runs jobs for about 6.5 seconds, then stops. Every handler must finish well inside that budget, because the hosted app is serverless.
- **A handler returns one of three ways:**
  - `done(job, result)`: finished.
  - `park(job, { ms, payload })`: not finished, come back in `ms`. Use this for anything slow (an agent session, a painting, a phone call): start it, store its id in `payload`, park, and check on the next visit.
  - throw: `fail()` retries with backoff up to 4 attempts, then marks the job `failed` and writes `job_failed` to the ledger. Throw `new Retry(msg, ms)` for a transient error that should not count as an attempt.
- **Agent calls are phases.** `agentPhase(job, {...})` starts a Naïve session, parks the job, and resumes when the session is done. Never `await` a long model call inside a handler.
- **Every consequence is a ledger line.** Call `ledger(kind, actor, detail, order_id)` from `app/src/db.js`. Lines are hash-chained, so they are append-only by design. Keep `detail` small and never put secrets, full emails or full phone numbers in it (the Mailroom masks them).

## Add a desk

A desk is one job kind with one handler. To add, say, a Translator desk:

1. **Write the handler** in `app/src/engine.js` as `H.translate = async (job) => { ... }`. Keep each visit short; use `park` for anything slow and `agentPhase` for anything a model does.
2. **If a model does the work, give it a prompt** in `prompts/translator.md` and a JSON schema in `app/src/prompts.js`. `gen-prompts.mjs` exports every `prompts/*.md` as a constant named after the file (`TRANSLATOR`). Models return JSON; code decides what happens next.
3. **If the agent is new, declare it** in `naive.config.ts` with a budget and deny-by-default tools, and add its id to the env (see how `NAIVE_AGENT_AUTHOR` is wired in `app/src/naive.js`).
4. **Enqueue it** from the step before it, and enqueue the next step when it is done.
5. **Log it.** Write at least one ledger line when the desk does something that matters, with an actor like `agent:translator` or `code:translator`.
6. **Show it.** Map the new ledger kind in `app/public/js/order.js` (the making-of timeline) and, if you like, give it a desk in `app/public/js/office.js`.
7. **Document it** in the staff table in the README and in [docs/HOW_A_BOOK_IS_MADE.md](docs/HOW_A_BOOK_IS_MADE.md).

Open a [New desk](https://github.com/vnmoorthy/nightlight-press/issues/new?template=new_desk.yml) issue first if you want feedback on the idea.

## Rules that are not up for debate

- **Models write, code decides.** Anything that matters for safety, money or who gets contacted lives in code, not in a prompt.
- **Children first.** No change may weaken the Editor's checks, the grown-up gates, consent, AI disclosure, the grown-up's choice to leave Pip out, or opt-in public posting.
- **No secrets in the repo, the ledger or logs.** Keys come from the environment only.
- **No fake numbers.** Any timing or cost in the docs must come from a real run.

## Style

- **JavaScript:** ES modules, Node 20, no TypeScript build step in `app/`. Match the surrounding code: small functions, early returns, SQL inline with numbered parameters (never string-concatenate user input into SQL).
- **Dependencies:** think twice. Every dependency ships in the serverless bundle.
- **Prompts:** plain Markdown, `{{placeholders}}` filled by `fill()`, one job per prompt, and always "Return only JSON matching the schema."
- **Docs and UI copy:** short sentences, plain words, warm and calm. Write for a tired parent at bedtime.
- **Commits and PRs:** one change per pull request, a clear title in the imperative mood, and a description of how you tested it. Screenshots for anything visual.

## Good first issues

Ideas that are scoped and ready are in [docs/STARTER_ISSUES.json](docs/STARTER_ISSUES.json). Comment on the issue before you start so two people do not build the same thing.
