# Quickstart

Run the whole company on your laptop, make a book, then (optionally) deploy your own on Naïve.

## 1. What you need

- **Node.js 20 or newer** (`node --version`)
- **Docker**, for a local Postgres (or any Postgres you already have)
- **Keys**, one per desk you want to see working:

| Key | Unlocks | Without it |
|---|---|---|
| `NAIVE_API_KEY` + `NAIVE_AGENT_*` | Author, Front Desk, Marketing, narration | No story is written, so no book is made |
| `MONID_API_KEY` | Paintings, Kling films, SMS, the Storyteller Line | No pictures, so the book never binds |
| `AGENTMAIL_API_KEY` + `AGENTMAIL_INBOX_ID` | Emailing books, reading replies | The book is still readable at `/book/<id>`; delivery is logged as failed |
| `MOBILERUN_API_KEY` + `MOBILERUN_DEVICE_ID` | The iPhone proof | Proofs are skipped and that is logged (they are also skipped on `localhost`, which a real phone cannot open) |
| `OPENAI_API_KEY` | Narration fallback, server transcription on `/tell` | Narration relies on Naïve speech alone |
| `STRIPE_SECRET_KEY` | Real payments | The Cashier runs in pledge mode |

The Naïve agents are created by the blueprint in [`naive.config.ts`](../naive.config.ts); see step 6 if you do not have their ids yet.

## 2. Get the code and your config

```bash
git clone https://github.com/vnmoorthy/nightlight-press
cd nightlight-press
cp .env.example .env
cp app/.env.example app/.env.local
```

Fill in `.env` with your keys. Both files are gitignored; never commit them. Every variable has a comment in [`.env.example`](../.env.example) and [`app/.env.example`](../app/.env.example).

## 3. Start Postgres

```bash
docker run -d --name nightlight-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=nightlight postgres:16
```

In `app/.env.local`, set:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/nightlight
```

## 4. Run the app

```bash
cd app
npm i
./dev.sh
```

`dev.sh` loads `../.env` and `.env.local`, compiles the prompts, migrations and fonts into `src/prompts.generated.js`, and starts the server on **http://localhost:3100** with file watching. Migrations apply on boot, and a local clock ticks the queue every 3 seconds.

## 5. Make a book

| Page | What to do |
|---|---|
| http://localhost:3100/ | Order a book. Without Stripe it is recorded as a pledge and production starts right away. |
| http://localhost:3100/tell | Tell a story out loud (or type one), tick the grown-up box, press **Make it a book**. |
| http://localhost:3100/order/&lt;id&gt; | Watch the book being made, line by line from the ledger. |
| http://localhost:3100/book/&lt;id&gt; | Read it, and press **Read to me**. |
| http://localhost:3100/office | Watch the desks work in 3D. Press **Replay** for the last book. |
| http://localhost:3100/board | The public board: books, recent ledger lines, human interventions and ledger integrity. |
| http://localhost:3100/api/verify | Re-check the ledger's hash chain. |

Two things only work on a public `https://` address: the Film desk (Kling needs to fetch the painting) and self-continuation. Locally the 3-second clock does the waking instead.

## 6. Deploy your own company on Naïve

```bash
cd ..                         # back to the repo root
npm install                   # the Naïve SDK and CLI
NL_WITH_APPS=0 ./deploy.sh    # first time only: create the agents
# put the agent ids into NAIVE_AGENT_AUTHOR, NAIVE_AGENT_FRONTDESK, NAIVE_AGENT_MARKETER in .env
./deploy.sh                   # build the app and bring up everything else
```

`deploy.sh` bundles the app with esbuild, then runs `naive up` against `naive.config.ts` to reconcile the identity, the vault, the agents, the Night Manager's 5-minute schedule, the hosted app with its Postgres and MCP endpoint, and the webhooks. It retries when Naïve is busy.

After it is up:

- Set `PUBLIC_BASE_URL` to the app's `https://` address and deploy again, so links in emails, films and self-continuation use it.
- Point AgentMail's `message.received` webhook at `/api/webhooks/agentmail` and set `AGENTMAIL_WEBHOOK_SECRET`, so replies become revisions.
- Set `NAIVE_WEBHOOK_SECRET` for the `session.idle` webhook, and `NL_ADMIN_TOKEN` for the admin pages.

## 7. Make it yours

- **World:** edit [`prompts/world.md`](../prompts/world.md), [`world_art.md`](../prompts/world_art.md) and [`world_seeds.md`](../prompts/world_seeds.md), or set `WORLD=classic`.
- **Staff:** edit the prompts in [`prompts/`](../prompts/). `dev.sh` recompiles them on start.
- **Robot:** `ROBOT_LOOK` and `ROBOT_STORY` in `app/src/prompts.js`; the toy link is `PLAYROBOT_TOY_URL`.
- **Price and length:** `PRICE_CENTS`, `BOOK_PAGES`, `TOLD_PAGES`.

## Troubleshooting

- **`DATABASE_URL` errors on start:** check that the container is running (`docker ps`) and that `app/.env.local` has the URL.
- **The book stops at "writing":** the Author's agent id or `NAIVE_API_KEY` is missing. Look for `job_failed` in `/api/ledger.json` and in the server output.
- **The book stops at "illustrating":** check `MONID_API_KEY`. A painting run that takes over 4 minutes is restarted automatically.
- **No email:** check `AGENTMAIL_API_KEY` and `AGENTMAIL_INBOX_ID`; look for `deliver_failed` on the ledger.
- **Something failed four times:** it is on the ledger as `job_failed`. Retrying from the admin page is logged as an `intervention`.

Next: [How a book is made](HOW_A_BOOK_IS_MADE.md) · [Architecture](ARCHITECTURE.md) · [Contributing](../CONTRIBUTING.md)
