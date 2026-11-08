# Changelog

All notable changes to Nightlight Press are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

- Project docs for contributors: quickstart, how a book is made, contributing guide, code of conduct, security policy, issue and pull request templates, `.env.example` files, and a CI workflow that syntax-checks and builds the app on every push.

## [v1.0-demo-day] - 2026-11-08

The version shown at the Naïve × YC Autonomous Company Hackathon. The demo-day deck is attached to the [release](https://github.com/vnmoorthy/nightlight-press/releases/tag/v1.0-demo-day).

### The company

- A children's picture-book publisher with twelve desks and no employees: Author, Editor, Illustrator, Narrator, Binder, Mailroom, Storyteller Line, Front Desk, Proofreader, Marketing, Cashier and Night Manager.
- Company blueprint in `naive.config.ts`: agents with budgets and deny-by-default tools, the Night Manager's 5-minute schedule, the hosted app with Postgres and an MCP endpoint, the vault, and `session.idle` webhooks. `deploy.sh` builds and reconciles it with retry.

### Making books

- **Order a book** at `/`: name, age, look, favourite things, occasion, 16 languages and several art styles; $19 through Stripe Checkout, or honest pledge mode without a Stripe key.
- **Tell a story** at `/tell`: speak, see your words as you talk, and the line turns *your* story into a book. A grown-up permission box, and Pip on by default.
- **Production line:** Author (Naïve agent) → Editor (code: word limits by age, the hero's name, banned words and brands, reading grade, one rewrite with the exact problems) → paintings (Monid) and narration (Naïve speech, OpenAI fallback) in parallel → Binder (PDFKit, print-ready 11 × 8.5 in) → Mailroom (AgentMail email with the PDF, Monid SMS to US numbers).
- **Film desk:** the cover and two key pages animated into short Kling films through Monid.
- **Proofreader:** each finished book opened on a real iPhone 16 through Mobilerun, with the title compared letter by letter and what the phone saw logged.
- **Storyteller Line:** phones a grandparent and reads the book aloud; says it is an AI, needs consent, at most 3 calls per book.
- **Revisions by email:** a reply fires AgentMail's webhook, the Front Desk routes it, and only the changed pages are redone.
- **Fernhush Bay:** a storyworld of robots, people with bionic parts and kids, designed by GPT-6 Astra, used by every book (`WORLD=classic` turns it off).
- **Pip the PlayRobot:** an optional, disclosed robot friend (a checkbox the grown-up can untick) drawn the same on every page; the Editor rejects pages about buying, shops or prices. Tapping Pip opens a hold-for-3-seconds grown-up gate before the toy page.
- A fixed cast description for supporting characters, so faces stay the same across pages.
- A "Learn about robots" page in every book.

### Running itself

- Durable Postgres job queue with leases (`for update skip locked`); each tick works for about 6.5 seconds and parks anything slow, so it runs on serverless hosting.
- Agent calls as resumable phases: start, park, check, resume.
- Four clocks (Night Manager cron, `session.idle` webhook, AgentMail webhook, page pulses) plus self-continuation, so a book finishes with nobody watching.
- Marketing commissions a free shelf book every 12 hours with an atomic claim, publishes it to `/shelf` and emails subscribers.
- Retries with backoff; anything that still fails is logged publicly as `job_failed`.

### Seeing it

- Hash-chained public ledger, re-checked by `/api/verify`; every human action is logged as an `intervention`.
- `/board`: the company's public board. `/order/<id>`: the making-of page, live. `/book/<id>`: the reader with **Read to me**.
- `/office`: a live Three.js office where each desk acts out its ledger lines, with **Replay**.
- GitHub Pages showcase and a static PlayRobot store.
- Blender cinematics (office fly-through, book opening, hero) scripted by GPT-6 Astra.
- Magic Hour theme across the shop, reader, Tell page, office and printed book.

### Measured on demo day

- Kai's spoken request → bound book in 1.1 min, emailed at 1.2 min, iPhone proof at 2 min, three films at 2.2 min.
- Ravi's book completed with nobody watching.
- Order → inbox in 102 s (local run, 10 pages); revision request → revised book emailed in 46 s.
- About $1.60 to make a $19 book, about 90% gross margin.

[Unreleased]: https://github.com/vnmoorthy/nightlight-press/compare/v1.0-demo-day...HEAD
[v1.0-demo-day]: https://github.com/vnmoorthy/nightlight-press/releases/tag/v1.0-demo-day
