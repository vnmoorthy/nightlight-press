# How a book is made

This is one book's trip down the line, step by step: which prompt or program does each step, what the Editor checks, and which lines land on the public ledger. Everything here is in [`app/src/engine.js`](../app/src/engine.js) unless it says otherwise. For the queue, the clocks and the ledger in general, see [ARCHITECTURE.md](ARCHITECTURE.md).

**Measured on the real line:** Kai's spoken request became a bound book in 1.1 minutes, was emailed at 1.2, proofread on an iPhone at 2.0, and had three films at 2.2. A typed order reached the inbox in 102 s (local run, 10 pages). A revision request was answered with a revised book in 46 s.

## The cast of prompts

| Prompt | Used by | Its one job |
|---|---|---|
| [`prompts/author.md`](../prompts/author.md) | Author (Naïve agent) | Write a new book from what the family typed: exact page count, a word limit per page, a fixed `hero_look`, a `cast` of recurring characters with fixed looks, a dedication, a blurb, and three true `robot_facts`. |
| [`prompts/teller.md`](../prompts/teller.md) | Author, for told stories | Turn a transcribed story told out loud into a book, keeping the teller's plot, characters and phrases, or write an original one if they asked for a story instead of telling one. |
| [`prompts/frontdesk.md`](../prompts/frontdesk.md) | Front Desk (Naïve agent) | Read a family's message and return an `intent` (`revise_text`, `revise_art`, `revise_both`, `question`, `thanks`, `refund`, `other`), the pages to change, precise instructions, a reply, and whether a person must look. |
| [`prompts/marketer.md`](../prompts/marketer.md) | Marketing (Naïve agent) | Pick tonight's free shelf book (hero, theme, style) and write the caption. |
| [`prompts/world.md`](../prompts/world.md), [`world_art.md`](../prompts/world_art.md), [`world_seeds.md`](../prompts/world_seeds.md) | Author, Illustrator, Marketing | The Fernhush Bay world bible, its art direction, and story seeds. Turned off with `WORLD=classic`. |

Every agent returns JSON against a schema in [`app/src/prompts.js`](../app/src/prompts.js). These agents have no tools and no access to the app; code reads their JSON and decides what happens next.

## 1. The request

**Typed order** (`POST /api/orders`): name, age, pronoun, look, favourite things, occasion, language (16), art style, and optionally a grandparent's number for the Storyteller Line. The Cashier starts Stripe Checkout at $19, or, with no Stripe key, records an honest pledge that is never counted as revenue.

**Told story** (`POST /api/tell`): the browser transcribes speech live (or the server transcribes a recording once and discards it). The request is refused unless a grown-up ticked the permission box. Told books are free, so they are rate-limited (one a minute, `TOLD_PER_DAY` a day), and they go on the public shelf only if *Share* was ticked.

Ledger: `order` → `checkout` → `payment` for a typed order; `told` for a told story.

## 2. Commission

`startBook()` opens a book row, marks the order as making, and enqueues one `write` job.

Ledger: `commission` (hero, age, style, language, kind, whether Pip is in).

## 3. Write

The `write` job fills `author.md` (or `teller.md`) with the child's details, the page count (`BOOK_PAGES`, default 10; `TOLD_PAGES`, default 8), the word limit for their age, Pip's description if Pip is included, and the world bible. It starts a Naïve agent session, **parks itself**, and comes back to check. A slow model never holds a worker; a session that runs past 5 minutes is restarted.

Ledger: `agent_start` (actor `agent:author`).

## 4. The Editor

The Editor is a program ([`app/src/editor.js`](../app/src/editor.js)), not a model. Before a single picture is painted it checks:

| Check | Rule |
|---|---|
| Length | At least 6 pages. |
| Words per page | Age 3 and under: 25 · 4 to 5: 35 · 6 to 7: 45 · older: 60 (a little slack is allowed). |
| The hero | The child's first name appears on at least half the pages. |
| Unsuitable words | A fixed list (violence, insults, alcohol, and so on). |
| Trademarks | A fixed list of characters and brands children love but the book may not use. |
| Links | No web addresses. |
| Reading grade | Computed for English text and recorded. |
| Robot facts | At least three, each at most 25 words. |
| No sales talk | If Pip is in the book, any page mentioning buying, shops or prices fails. |

If the draft fails, it goes back to the Author **once**, with the exact list of problems and the previous draft. The result of every round is public.

Ledger: `edit_check` (pass, issues, words, reading grade, round), then `story` (title, pages, words).

## 5. Paint, narrate (in parallel)

The `write` job fans out one `paint` job for the cover, then one `paint` and one `narrate` job for every page.

- **Illustrator** (Monid image model): each prompt repeats the hero's fixed look, Pip's fixed look if Pip is included, and every recurring cast member's look, so faces stay the same from page to page. It forbids any text in the picture. Paintings cost about $0.011 each, 8 to 11 per book. The job starts a run, parks, checks back, then resizes the image with sharp.
- **Narrator** (Naïve speech, OpenAI TTS as a fallback): records each page for **Read to me**.

When the last page has both a picture and a voice and the cover exists, `maybeBind()` enqueues `bind`.

Ledger: `paint` (page, bytes, cost) and `narrate` (page), one per page.

## 6. Bind

The **Binder** ([`app/src/picturebook.js`](../app/src/picturebook.js), PDFKit) lays out a print-ready 11 × 8.5 in landscape PDF: cover, dedication, the pages, a "Learn about robots" page with the Author's three facts, and a colophon that discloses Pip when Pip is in the book.

Ledger: `bind` (pages, PDF size, minutes since the order). For Kai's book this said 1.1.

## 7. Deliver

The **Mailroom** emails the PDF and the reader link through AgentMail, and texts US numbers through Monid. Addresses and numbers are masked on the ledger. Every delivered book then goes to the Proofreader, and a book with a grandparent's number also gets the Storyteller Line. Marketing's shelf books skip delivery and go to `market` instead.

Ledger: `deliver` (or `deliver_failed`), `sms` (or `sms_failed`).

## 8. Proof, films and phone calls

- **Proofreader** (Mobilerun): opens `/book/<id>` in the phone's browser, reads the title back, takes a screenshot, and compares titles letter by letter. With no phone connected it logs `proof_skipped` once and moves on. Ledger: `agent_start` (actor `agent:proofreader`), `proof` (ok, what the phone saw).
- **Film desk** (Kling via Monid): animates the cover, a middle page and the last page into short films, at $0.21 each. It needs an `https://` `PUBLIC_BASE_URL` and is turned off with `FILM=0`. Ledger: `film`.
- **Storyteller Line** (Monid voice): calls the grandparent, introduces itself as an AI, asks before reading, and reads the book. At most 3 calls per book. Ledger: `read_call` (with `disclosed_ai: true`), `read_call_done`.

## 9. Revise

A family replies to the email, or types in the box beside the book. AgentMail's `message.received` webhook (Svix-signed) enqueues a `frontdesk` job and ticks the clock.

The **Front Desk** classifies the message. Questions and thanks get a reply. Refunds and anything worrying are escalated to a person. Revisions enqueue a `revise` job, which reruns the Author on the text if the words changed, repaints only the pages that changed, records a new look if the hero's appearance changed, and binds and re-emails the book.

Ledger: `frontdesk` (intent, pages, escalate), `clearance_requested` when a person must look, `story` (revised), `revise`, then `paint`/`narrate`/`bind`/`deliver` again.

## 10. The shelf, every 12 hours

Each tick tries one atomic claim in Postgres. If 12 hours (`SHELF_EVERY_HOURS`) have passed, it enqueues `commission` and the Marketing agent picks a hero and theme from the world's story seeds. The book goes down the same line, then `market` makes it public on `/shelf`, emails subscribers, and posts to social media only if `MOBILERUN_SOCIAL=1`.

Ledger: `commission_shelf`, the usual production lines, then `publish`.

## When something goes wrong

A handler that throws is retried with backoff (15 s, 30 s, 45 s). After 4 attempts the job is marked failed and the ledger gets `job_failed`, in public. If a person steps in, for example to retry failed jobs or commission a book by hand, it is written as an `intervention` and shown on the board. The fewer interventions, the more the company runs itself.

## What keeps it moving

No single process runs the line. Any of these ticks the queue: the Night Manager calling the MCP `tick` tool every 5 minutes, Naïve's `session.idle` webhook, AgentMail's reply webhook, any open making-of, reader, board or office page, and the app calling its own `/api/pulse` while work is due (one chain at a time, with a depth cap). That last one is why Ravi's book finished with nobody watching.

## Check it yourself

- Watch any book at `/order/<id>`; the timeline is its ledger lines.
- Read the whole ledger at `/api/ledger.json` and re-verify the hash chain at `/api/verify`.
- Watch the desks act it out at `/office`.
