# Nightlight Press: storyboard and demo run sheet

Three parts:

1. A 3-minute pitch, keyed to the 10 slides in `deck/Nightlight.pptx`
2. A 10-minute live demo on the hosted app
3. Fallbacks for when something is slow

- Hosted app: https://nightlight-press-z5ept2z3by3j.vercel.app (below, `HOST` means this address)
- Local copy: http://localhost:3100. It has the finished book `/book/bk_a8da18bcb7fa434dad76`, "Maya's Little Brave Hello".

> **One rule for the stage:** every human action is logged as an intervention on the public `/board`. Use only the buyer's controls: the order form, the box beside the book, "Read to me", "Call and read it" and "Replay the last book". Do not press "Wake the office now" or "Retry failed jobs" during the demo, because both show up on the board as interventions.

---

## Part 1: 3-minute pitch (10 slides)

**Before you walk on (T minus 2 min):**
- Place one real order on `HOST/` for "Maya", using the steps in Part 2, minute 1.
- That order will be painting while you talk, so the office is busy when you cut to it at 1:25.
- Keep `HOST/office` open in the next browser tab, behind the deck.

| Time | Slide | What is on screen |
|---|---|---|
| 0:00–0:15 | 1. A bedtime book starring your child. Made by a company with no employees. | `blender/office_flythrough.mp4` plays in a loop |
| 0:15–0:30 | 2. Every child wants to be the hero | `book/page-01.jpg`, a painted page from a real book |
| 0:30–0:50 | 3. From order to bedtime in three screens | Screenshots of the order form, the making-of page and the reader |
| 0:50–1:05 | 4. A real book, painted for one child | `book/collage.jpg` |
| 1:05–1:25 | 5. Twelve desks. Nobody on payroll. | The twelve-desk org chart |
| 1:25–1:50 | 6. Watch the company work | **Cut to the live product** (`HOST/office`). `office.mp4` is the fallback |
| 1:50–2:10 | 7. How it runs without us | The clocks and the engine |
| 2:10–2:25 | 8. $19 a book, about 94% gross margin | Unit economics, plus "102 s" and "46 s" |
| 2:25–2:45 | 9. Each sponsor does a real job | Sponsor jobs and `mobilerun/iphone-proof-4.png` |
| 2:45–3:00 | 10. It runs while you sleep | `blender/book_open.mp4` |

### 0:00–0:15, Slide 1: the title
**Say:** "Nightlight Press makes a picture book starring your child. It costs nineteen dollars. It's written, painted, read aloud and delivered in about two minutes. The company has no employees."

### 0:15–0:30, Slide 2: Every child wants to be the hero
**Say:** "Kids want to see themselves in the story, with their name, their dog and their first day of school. A custom illustrated book usually takes weeks and costs a lot. We make one for a single child for nineteen dollars."

### 0:30–0:50, Slide 3: From order to bedtime in three screens
**Say (point left to right):** "A parent fills in one form. They watch the book get made, page by page. Then they get a PDF ready to print, and a web book with a 'Read to me' button. If they want a change, they reply to the email. Revisions are free."

### 0:50–1:05, Slide 4: A real book, painted for one child
**Say:** "Every book has ten painted pages and a painted cover. It comes as an eleven-by-eight-and-a-half landscape PDF, ready for print. The child's name is on every page. It's written in the child's language, and we support sixteen."

### 1:05–1:25, Slide 5: Twelve desks. Nobody on payroll.
**Say:** "Twelve desks run the company:
- An Author writes the story and an Editor checks it.
- The Illustrator paints on Monid and the Narrator reads aloud on Naïve speech.
- A Binder makes the PDF and the Mailroom sends it with AgentMail.
- A Storyteller Line phones the book to a grandparent.
- The Front Desk answers email and a Proofreader checks every book on a real phone.
- Marketing makes shelf books, a Cashier takes payment, and a Night Manager keeps it all moving.

The writing is done by models. The rules are enforced in code."

### 1:25–1:50, Slide 6: Watch the company work (the cut to the live product)

**Cut now.** As soon as you've said the slide title, switch to the `HOST/office` browser tab.

- If the tab is not ready within 3 seconds, stay on the slide and play `office.mp4`.
- Note: the video on this slide still shows the old dark theme. That is another reason to show the live office.

**Say:** "This is the office, live, right now. That book I ordered two minutes ago is moving through it. You can see the Author handing off to the Editor, and the Illustrator painting. Nobody here is a person."

**Cut back** to the deck at 1:50 and go to slide 7.

### 1:50–2:10, Slide 7: How it runs without us
**Say:** "Four clocks wake the company:
- a Naïve scheduled agent every five minutes
- Naïve session webhooks
- AgentMail's incoming-mail webhook
- page visits

After each step, it calls itself again while there's work due. Jobs sit in a Postgres queue with leases, and every step takes under seven seconds. Every action goes into a hash-chained public ledger."

### 2:10–2:25, Slide 8: $19 a book, about 94% gross margin
**Say:** "Our local measurements:
- Order to emailed book: a hundred and two seconds.
- A change request back in the inbox: forty-six seconds.
- Costs per book: twelve cents for the paintings, under a cent for the agents and eighty-five cents to Stripe.

That's about ninety-four percent gross margin."

### 2:25–2:45, Slide 9: Each sponsor does a real job
**Say:** "Each sponsor does a real job:
- AgentMail delivers the book and reads the replies.
- Monid paints the pages, sends texts and runs the phone line.
- Mobilerun is our proofreader. This morning it opened the live site on a real iPhone 16 and read the headline back, word for word, in three steps.

All of it is built on Naïve."

### 2:45–3:00, Slide 10: It runs while you sleep
**Say:** "Every human action is posted on our public board as an intervention, and the goal is zero. Tonight, someone's kid gets a book about themselves, and none of us will be awake for it. Thank you."

---

## Part 2: 10-minute live demo run sheet (hosted app)

### Before the demo (start 15 minutes ahead)

**iPhone**
- [ ] Unlocked, with **Auto-Lock set to Never** (Settings > Display & Brightness), and charging.
- [ ] Do Not Disturb is on, but calls are allowed from the Nightlight number if you plan to demo the Storyteller Line.

**Laptop browser**
- [ ] The **Mobilerun** Chrome tab is open and shows the phone as connected.
- [ ] Tabs open, in this order:
  1. `HOST/`
  2. `HOST/office`
  3. `HOST/board`
  4. the founder's inbox (the address you will type as `buyer_email`)
  5. `http://localhost:3100/book/bk_a8da18bcb7fa434dad76` (the fallback book)
- [ ] `assets/office.mp4` is open in a video player and paused (fallback).

**Before you go on stage**
- [ ] Check that `/board` says the ledger is verified and the hash chain is intact. Note the current interventions count so you can quote it.
- [ ] Hosted checkout runs in **pledge mode** (no Stripe key). The submit button reads "Make the book (free while …". Say so plainly; do not pretend it is a live charge.
- [ ] Laptop: notifications off, volume up (you need it for "Read to me"), and the browser zoomed to 125%.

### Minute-by-minute

**0:00–1:00: Place an order on stage.** Go to `HOST/` and type:

| Field | Type |
|---|---|
| Child's name | `Maya` |
| Age | `5` |
| Pronoun | `she` |
| Language | `English` |
| What she looks like | `Curly hair, red glasses, a yellow raincoat` |
| Favorites | `Dinosaurs, swimming, Grandma's mango lassi` (leave out the dog, because it is added later as the change request) |
| Occasion | `Starting kindergarten next week and feeling a bit nervous` |
| Your name / email | the founder's name and inbox |
| Phone | leave blank for now |

Then press the submit button, "Make it a book" (in pledge mode it reads "Make the book (free while …").

**Say:** "That's the only thing a person does in this whole flow."

**1:00–3:00: Watch the book get made.** The page goes to `/order/<id>`.
- **Say:** "The Author is writing. The Editor checks word limits for a five-year-old, makes sure her name is on every page, and checks the reading level. If a draft fails, it goes back once."
- Point at pages filling in one at a time as the Illustrator paints them.

**3:00–4:00: Show the office.** Switch to the `/office` tab.
- **Say:** "The same order, as a building. Each desk is one of the twelve staff. Watch the Illustrator and then the Binder pick it up."
- Switch back to `/order/<id>` and confirm it says the book is bound.

**4:00–5:00: Open the email.** Switch to the inbox tab and open the Nightlight email, sent by AgentMail.
- Open the attached PDF and scroll through two pages.
- **Say:** "Eleven by eight and a half, ready for print. About a hundred seconds from order to inbox."

**5:00–6:00: Open the reader.** Click the book link in the email, which opens `/book/<id>`.
- Press **"▶ Read to me"** and let one page play.
- **Say:** "The narration is Naïve speech. In our local run, nineteen of twenty-five pages came from it."
- Flip to the next page.

**6:00–7:30: Ask for a change.**
- In the box beside the book, type: `Her dog is called Biscuit` and press **"Send to the Front Desk"**.
  - The alternative is to reply to the email with the same line. Use that if you want to show the AgentMail inbound webhook.
- **Say:** "The Front Desk reads it, the Author rewrites, the Editor checks, the Illustrator repaints, and the Mailroom sends it again. Locally that took forty-six seconds."
- Keep talking until the revised email arrives in the inbox. Open it and show Biscuit on a page.

**7:30–8:15 (optional): The Storyteller Line.** Only call **the founder's own phone**.
- Use the call option beside the book (**"Call and read it"**):
  - Enter the founder's own name and number.
  - Tick the **consent box**.
  - Press the button.
- **Say:** "It says it's an AI at the start, it needs consent, and it calls at most three times per book."
- Put the phone on speaker for ten seconds, then hang up.
- Skip this step if you are past 7:30.

**8:15–9:00: The Proofreader result from the iPhone.** Show the Mobilerun Chrome tab, or the phone itself, with `assets/mobilerun/iphone-proof-*.png` as the backup.
- **Say:** "Mobilerun opens each finished book on a real phone. This morning on this iPhone 16, it opened the live site in Safari and read the headline back exactly, in three steps."

**9:00–10:00: The board.** Switch to `/board` and point at three things:
- **Ledger verified:** "Every event is hashed together with the one before it. If anyone edits history, the check fails."
- **Interventions by a person:** "This is every time a human touched the company. Today's number is ___." Read the real number off the screen.
- **Unit economics:** "$19 in. About twelve cents of paintings, under a cent of agents and eighty-five cents of Stripe fee. About 94% gross margin."
- **Close:** "Nobody pressed anything since the order. That's the company."

---

## Part 3: Fallbacks

**The order is slow to paint (no pages by 2:30)**
- **Do:** Go to `/office` and press **"Replay the last book"**. This replays a finished book's run through the office, so you keep talking over real motion.
- **Say:** "This is the replay of the last book. The one we just ordered is still in the queue, and we'll come back to it."
- **Do not:** press "Wake the office now". It is logged as an intervention.

**The hosted app is slow or down**
- Switch to the local copy at http://localhost:3100. It runs the same code.
- Use the finished book `/book/bk_a8da18bcb7fa434dad76` ("Maya's Little Brave Hello"), its order `/order/ord_a5e8d706a0374b228dfe`, and the PDF at `/api/book/bk_a8da18bcb7fa434dad76.pdf`.

**The office does not load (WebGL or Three.js problem)**
- Play `assets/office.mp4`, the pre-recorded office.
- **Say:** "This is a recording of the same office."

**The email has not arrived by 5:00**
- Open the PDF straight from `/order/<id>` or from the local PDF link above.
- Come back to the inbox at the end.

**The revision is slow (more than 90 seconds)**
- Move on to the Storyteller Line or the board, and come back to the inbox before closing.

**"Read to me" makes no sound**
- Check the laptop volume and output device.
- Otherwise, open the local book and press "Read to me" there.

**The iPhone or Mobilerun is not connected**
- Show the stored screenshots in `assets/mobilerun/` (`iphone-proof-1.png` to `iphone-proof-4.png`).
- **Say:** "These are from the run at 7:48 this morning."

**The live cut on slide 6 fails during the pitch**
- Stay on the slide and play `office.mp4`.
- Do not troubleshoot on stage.
