# Security policy

Nightlight Press handles API keys for paid services, signed webhooks, payments, and details that families type about their children. Please report problems privately so they can be fixed before anyone is put at risk.

## How to report

**Do not open a public issue.** Use GitHub's private reporting instead:

1. Go to the repository's [**Security** tab](https://github.com/vnmoorthy/nightlight-press/security).
2. Choose **Report a vulnerability** to open a [private security advisory](https://github.com/vnmoorthy/nightlight-press/security/advisories/new).
3. Describe the problem, how to reproduce it, and what an attacker could do with it.

Please do not include real children's data, real API keys, or anyone else's personal information in your report. If you accidentally found any, say what kind of data it was rather than pasting it.

This is a small project maintained by one person. You will get an acknowledgement as soon as the report has been read, and we will keep you updated until it is resolved. We are happy to credit you in the advisory and the changelog if you want.

## In scope

- **Keys and secrets.** Any way to read sponsor keys (Naïve, Monid, AgentMail, Mobilerun, OpenAI, Stripe), the admin token, or webhook secrets, whether through the app, the logs, the ledger, the bundle, or the repository.
- **Webhook signatures.** Bypassing the Svix signature check on AgentMail's `message.received` webhook or the HMAC check on Naïve's `session.idle` webhook, or replaying a signed request to trigger work.
- **Child data.** Reading or changing an order, a child's name, look, age, a family's email or phone number, a told story, or an unlisted book you were not given the link to; anything that puts personal details on the public ledger, board or shelf.
- **Admin and MCP access.** Reaching `/admin`, `/api/admin/*` or the MCP tools without the right token.
- **Ledger integrity.** Changing a ledger line without `/api/verify` noticing.
- **Child safety controls.** Ways to get unsuitable text or images past the Editor, to skip the grown-up gates or consent, to make the Storyteller Line call without consent, or to make an agent act outside its tools.
- **Money.** Getting a book marked as paid without paying, or a pledge counted as revenue.

## Out of scope

- Reports from automated scanners with no demonstrated impact
- Denial of service through sheer request volume
- Problems in the sponsors' own services (please report those to them)
- Missing best-practice headers with no exploit

## Supported versions

Only the latest code on the default branch and the hosted demo are supported.
