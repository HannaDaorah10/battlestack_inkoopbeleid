# Inkoopbeleid — your assignment, explained from zero

You've been asked to build the **"0.2 Inkoopbeleid"** piece of the digital Inkoophuis platform. This
document explains what that thing even *is*, using two real, actual policy documents as evidence, and
then maps out exactly where it sits inside everything else your company is building. No prior
procurement knowledge assumed.

Sources used to write this: `Inkoopwijzer_2023.pdf` (Welbions), `Inkoopbeleid Ons Huis 2025-2028-def.pdf`
(Ons Huis), and `Adjust Inkoophuis.pdf` (the internal framework/platform deck) — all read in full.

---

## TL;DR

**"Inkoopbeleid"** = **procurement policy** = an organization's internal rulebook for how it spends
money with outside suppliers. It turns vague ambitions ("be sustainable," "be a good client") into
concrete rules: *if a purchase costs more than X, you need Y approvals and Z quotes.* Your assignment
sits in the **foundation** of a bigger house-shaped platform model ("Inkoophuis" = "Purchasing House"),
it depends on one sibling piece (a "vision" document) and feeds into another (an annual plan), and later
gets reused as reference material by at least three other rooms of the house. There is currently **no
dedicated AI tool built for it yet** in the company's roadmap — that gap is essentially your assignment.

---

## 1. What "inkoopbeleid" actually is

### The simplest way to think about it

Imagine a company's employees are constantly buying things from outside suppliers — a new roof, cleaning
services, software licenses, construction work. Without rules, every purchase would be handled
differently depending on who's buying and how they feel that day. **Inkoopbeleid is the rulebook that
prevents that.** It's not a legal contract and not a marketing brochure — it's an internal governance
document, similar in spirit to a company handbook, but specifically for "how we spend money with
outsiders."

We have two real, actual examples of this kind of document, from two different Dutch housing
corporations (**woningcorporatie** — a non-profit that owns and rents out affordable housing):

| | Welbions (`Inkoopwijzer_2023.pdf`) | Ons Huis (`Inkoopbeleid...2025-2028-def.pdf`) |
|---|---|---|
| Format | 2-page infographic/poster | 29-page formal policy document |
| Style | Quick-reference summary | Full governing document with chapters, appendices, sign-off |
| Covers | 2023 | 2025–2028 (their current one) |
| Useful for | Seeing the *shape* of the rules at a glance | Seeing the *complete* structure and real numbers |

Both describe the same underlying idea, just at different levels of detail — like a one-page cheat sheet
versus the full textbook.

### The core mechanic: goals + rules + an approval chain

Every inkoopbeleid we looked at has the same three ingredients:

1. **A short list of goals** — the *why*. What the organization wants its purchasing to achieve, beyond
   just "get the cheapest price."
2. **Concrete rules tied to money thresholds** — the *how*. Cross a specific euro amount, and the policy
   dictates exactly what has to happen (how many competing quotes, what documents, etc.).
3. **A named approval chain** — the *who*. Specific job titles or committees that must personally sign
   off once you cross a threshold.

Here's the goals list side by side — notice they're **not identical**, because each organization writes
its own:

| Welbions (6 goals) | Ons Huis (4 goals) |
|---|---|
| Duurzaamheid (sustainability) | Verduurzaming (sustainability) |
| Kosten (cost) | Betaalbaarheid (affordability) |
| Kwaliteit (quality) | Kwaliteit (quality) |
| Maatschappelijk betrokken (social involvement) | Sociale impact (social impact) |
| Proces (process) | *(not a separate goal here)* |
| Samenwerken (collaboration) | *(not a separate goal here)* |

**Lesson for you as a builder:** there is no single official, universal list of goals. Cost/affordability,
quality, sustainability, and social impact show up almost everywhere (they're the recurring themes), but
the exact wording and count is something each organization decides for itself. If you're storing this in
software, the goals list should be **editable per organization**, not hardcoded.

### Walking through two real purchases

The clearest way to understand the rules is to see them fire. Using Ons Huis's actual 2025–2028
thresholds (all amounts include VAT, and cover the whole contract, not just one year):

**Example A — a €30,000 cleaning contract** (a "Diensten en leveringen" / Services & Supplies purchase).
This lands in their €25,000–€50,000 tier: you need **2 competing quotes**, and you just have to record
the request-for-quote and the quotes you got. No special strategy document, no advisor required. Fast and
lightweight.

**Example B — a €2,500,000 roof-renovation project** (a "Werken" / Works purchase). This clears their
€2,000,000-and-up tier: you need **3 competing quotes** via a formal restricted tender procedure, a full
**category management** file (see below), and — because it's a Works purchase ≥ €2,000,000 — a
procurement advisor (**adviseur inkoop**) *must* be involved by policy, not just invited.

Same organization, same policy document — wildly different process, purely because of the euro amount.
That's the entire point of having thresholds: cheap, low-risk purchases stay fast; expensive or risky
ones get real scrutiny.

Both real documents also name an **approval chain** — specific roles that must sign off above certain
amounts. Ons Huis's version, for instance, gives their CEO (**directeur-bestuurder**) personal sign-off
authority up to €1,000,000, a "Manager Bedrijfsbeheer" (business-operations manager) up to €50,000, and so
on down through the organization — every role has its own euro ceiling. Cross it, and approval has to
come from someone higher up.

### "Pas toe of leg uit" — the escape hatch that makes it all work

Both documents lead with the same principle, almost word-for-word: **"pas toe of leg uit"** — literally
"apply it, or explain [why not]." **Comply or explain.** You're expected to follow the policy by default,
but you're allowed to deviate — *as long as you write down why*, and usually get a manager's sign-off on
that written explanation.

Why not just make the rules mandatory, no exceptions? Because procurement covers everything from a €50
office-supplies order to a €2.5 million construction project, all under one policy. A rule strict enough
for the risky end would smother tiny purchases in paperwork; a rule loose enough for tiny purchases would
leave big ones unmanaged. Comply-or-explain keeps one fast default while leaving room for judgment — and
the *written* explanation is what stops "deviating" from quietly turning into "ignoring the rules."

---

## 2. The shape of a complete inkoopbeleid document

The Ons Huis document is explicitly one of the real reference examples the company's own framework points
to for this exact task (more on that in Section 3). Its table of contents is effectively a **template**
for what a complete inkoopbeleid document contains, in order:

| # | Section | What it covers |
|---|---|---|
| 1 | Toepassing (Scope) | Who owns this policy, who it applies to, when it's valid |
| 2 | Opdrachtgeverschap | The organization's philosophy on being a good, professional client to suppliers |
| 3 | Inkoopdoelen | The goals (see Section 1 above) |
| 4 | Inkoopbeleidskaders en spelregels | The frameworks and "rules of the game" — including comply-or-explain |
| 5 | Categoriemanagement | Their operating method for organizing purchases by category (see below) |
| 6 | Procedures, drempelbedragen en werkwijze | The concrete euro thresholds and step-by-step procedures |
| 7 | Inkooporganisatie | Who's who — roles, responsibilities, committees |
| 8 | Realisatie van doelstellingen | How the goals from Ch. 3 actually get delivered in practice |
| 9 | Inkoopproces en overgangsperiode | The rollout/transition plan for adopting this policy |
| 10 | Bijlagen | Appendices — reference tables, legacy procedures, forms |

**Category management (Ch. 5)**, worth calling out on its own: instead of treating every purchase as a
one-off, related purchases get grouped into a "category" (e.g., "roofing," "IT hardware," "cleaning") and
managed as a repeating cycle: **Quickscan → Startdocument → Categorieplan (category plan) → Inkoopstrategie
(sourcing strategy) → Gunningsadvies (award recommendation) → Contractkaart (contract summary) → KPI
update**, then loop back. This is the same "Plan → Do → Check → Act" idea you may already know from
software/quality processes, just applied to purchasing categories.

---

## 3. Where your piece sits in the "Inkoophuis" (Purchasing House)

### The house, room by room

Your company (Adjust) models its whole consulting approach — and now its software platform — as a
literal house. A foundation at the bottom, a row of rooms standing on it, a roof on top:

| Room | Plain-English meaning |
|---|---|
| **0. Fundament** (Foundation) | The base everything else stands on: vision, policy, annual plan, category-management approach. **Your assignment lives here.** |
| **1. Inzicht** (Insight) | Figuring out where you currently stand: procurement maturity, spend data, contracts, calendar. |
| **2.1 Processen** (Processes) | How procurement gets done, step by step — strategic, tactical, day-to-day. |
| **2.2 Organisatie** (Organization) | How the procurement team is structured, staffed, trained. |
| **2.3 Gereedschap** (Toolbox) | Practical templates, standard contract terms, KPI libraries. |
| **2.4 Systemen** (Systems) | The software procurement runs on — spend analysis, ERP, dashboards, contract registers. |
| **2.5 Samenwerking** (Collaboration) | Working with suppliers — vetting, sustainability checks, joint purchasing. |
| **3. Uitvoering** (Execution) | The actual buying and contract-managing, category by category. |
| **4. Sturing** (Steering) | Dashboards, KPIs, tracking progress, staying on course. |
| **Roof — Professioneel Opdrachtgeverschap** | Not a room — the overall *purpose*: the whole organization (not just procurement) being a skilled, capable client. |

The whole structure also gets read as a repeating cycle — **Analyse → Uitvoering → Evaluatie**
(Analyze → Execute → Evaluate) — with Room 1 doing the analyzing, the middle rooms plus Room 3 doing the
executing, and Room 4 evaluating, looping back around.

### Zooming into the Foundation (0. Fundament)

The Foundation room has exactly 4 building blocks:

- **0.1 Visie op opdrachtgeverschap** — Vision on being a good client
- **0.2 Inkoopbeleid** — **← your piece**
- **0.3 Jaarplan inkoop- en contractmanagement** — Annual procurement & contract-management plan
- **0.4 Categoriemanagement** — Category management (the least fleshed-out of the four so far)

### Visie vs. Beleid vs. Plan — three words that sound similar but aren't

It's easy to blur these together, so here's the company's own working definitions, which explain exactly
why 0.1, 0.2, and 0.3 are treated as three separate deliverables instead of one:

| Term | Definition |
|---|---|
| **Visie** (Vision) | An inspiring picture of the future you're aiming for. |
| **Beleid** (Policy) | The rules, principles and ways of working that make sure goals actually get met. |
| **Plan** | A decision to run specific activities, in order, that should produce a defined result. |

So: the **Vision** (0.1) paints the destination, the **Policy** (0.2 — your piece) writes the rulebook for
getting there, and the **Plan** (0.3) schedules the concrete work for the coming year.

### The 5 steps you need to support

This is the exact workflow the company's framework defines for producing an inkoopbeleid — effectively
the process your software needs to digitize:

| Step | Dutch | What it means |
|---|---|---|
| 0.2.1 | Analyse bestaand beleid en kaders | Review whatever policy/rules already exist today |
| 0.2.2 | Herijken uitgangspunten en spelregels met stakeholders | Rework the basic principles and rules together with the people affected |
| 0.2.3 | Opstellen concept inkoopbeleid | Write a first draft |
| 0.2.4 | Bespreken concept inkoopbeleid | Discuss/review the draft |
| 0.2.5 | Vaststellen inkoopbeleid | Get it formally approved — it becomes official |

It's a standard "review → co-design → draft → review → approve" policy cycle — nothing exotic about the
shape, which is good news: it's a well-understood pattern to build a workflow around.

The framework also names the real reference documents to use as inputs for this step, and here's a handy
fact: **you already have 2 of the 3 documents it names** — `Inkoopbeleid Ons Huis 2025-2028-def.docx`
(you have the PDF) and `Inkoopwijzer_2023.pdf` (Welbions) — the only one you're missing is
`Ymere Inkoopbeleid 2024 DEFINITIEF.docx`, from a housing corporation called Ymere.

### How the foundation blocks depend on each other

The framework doesn't draw one single arrow diagram, but the same ordering shows up independently on at
least four different slides, which makes it a reliable signal rather than a guess:

```
0.1 Visie op opdrachtgeverschap  →  0.2 Inkoopbeleid  →  0.3 Jaarplan
        (the destination)          (the rulebook,        (this year's
                                     YOUR PIECE)           concrete work)
```

- **0.2's own input list explicitly names "Visie op opdrachtgeverschap"** as something that feeds it —
  the cleanest, most direct dependency in the whole framework.
- A companion slide states the logic in plain prose: the organization's overall strategy leads, and gets
  translated *through* the procurement policy/goals/strategy *into* everything else.
- A separate "transformation cascade" diagram draws the same order: organization goals → **set procurement
  goals / draft procurement policy** → formalize processes → organize staffing → digitize into systems →
  introduce contract management → set up communication standards.
- A closing 3-tier diagram places "Inkoopbeleid" at the **tactical level** — translating the
  organization's strategy (above it) down into day-to-day execution (below it).

**0.4 Categoriemanagement is the odd one out** — nothing in the framework ties it explicitly back to 0.1,
0.2, or 0.3 yet. It currently reads as the least-developed of the four blocks, not as a deliberate "no
dependency" design choice.

### Who reads/reuses inkoopbeleid later (downstream)

This is the part that shows *why* your piece matters beyond its own room — several other rooms explicitly
point back at it:

- **Room 2.1 Processen** — "Draft procurement policy" is literally listed as a step *inside* what a
  mature Strategic Procurement Process looks like. The tactical-processes block also reuses the exact
  same 3 reference documents as 0.2, with "current procurement policy" as its first listed input.
- **Room 2.2 Organisatie** — Explicitly lists "Fundament: inkoopbeleid" as a relevant source. Both the
  team's **training curriculum** ("Procurement Academy") and the **job/role profiles** for procurement
  staff cite the existing policy as reference material — makes sense, since a policy defines what the
  team is even supposed to be doing.
- **Room 4 Sturing** — Inkoopbeleid is named as one of four Foundation outputs feeding the steering and
  reporting room, alongside the annual plan, the vision, and category management.
- **Adjust's own client-onboarding process** — When starting with a *new* client, reviewing their current
  inkoopbeleid is literally the **first document type** the company's own diagnostic method looks at.
  That's a strong signal of how central this document is treated as, in practice, not just in theory.

Interestingly, Room 3 (Uitvoering — the actual day-to-day buying) does **not** explicitly cite inkoopbeleid
anywhere in the current framework, even though you'd expect it to. Worth knowing as a known gap rather
than assuming it's intentional.

### Inkoopbeleid as a maturity yardstick

Separately, the company scores how mature a client's whole procurement function is, on a 5-level scale:

1. **Gefragmenteerde Inkoop** — Every department buys on its own, reactively, no consistency.
2. **Gestructureerde Inkoop** — Standardized methods now exist; focus is mainly on cost savings.
3. **Gecoördineerde Inkoop** — Buying volume is pooled/coordinated across categories and suppliers.
4. **Geïntegreerde Toeleveringsketen** — Procurement is tightly integrated with the wider supply chain.
5. **Geoptimaliseerde Waardeketen** — Continuous optimization of the entire value chain (most advanced).

This score is measured across **6 dimensions**, and **"Beleid, Doelstellingen & Strategie"** (Policy,
Goals & Strategy) is one of them, alongside Processes, Organization, Methods & Communication, Systems, and
Suppliers. In other words: **the quality of an organization's inkoopbeleid is literally one of the six
yardsticks used every time the company scores a client's maturity.** Your piece isn't just an internal
building block — it's a measurement input used across the whole consulting practice.

---

## 4. Where this fits the bigger digital product

Separately from the Inkoophuis consulting model itself, the company also runs a 6-pillar internal program
for pushing into AI and digital tooling:

| Pillar | Nickname | What it is |
|---|---|---|
| 1. Training | "De basis" | Making sure staff and clients actually know how to use the new tools |
| 2. Tooling | "De versneller" | Off-the-shelf and custom software that speeds up daily work |
| 3. Marktontwikkeling | "De voelsprieten" | Watching the external market for new AI/procurement tech |
| 4. AI-initiatieven | "De kweekvijver" | An incubator for smaller experimental AI ideas |
| 5. Copilot omgeving | "De werkplaats" | An internal AI assistant environment for consultants |
| **6. Inkoopplatform** | **"Het kroonjuweel"** (the crown jewel) | **The flagship client-facing product** |

**Pillar 6 is the actual software product your piece belongs to** — it's the digital version of the whole
house described in Section 3, built for clients to use directly.

### The "digital advisor" angle — and the gap that's basically your assignment

Every one of the 4 Foundation blocks (including 0.2) is flagged for a planned **"Digitale adviseur"**
(AI advisor). The plan, based on the framework's own notes, is a **document-grounded assistant**: feed it
specific reference material (the current policy, the vision document, internal audit findings, management
ambitions) so it can help draft or update the actual policy text — not a generic, ungrounded chatbot.

Here's the important part: unlike some neighboring pieces (a "Quickscan tool" and a "Spendanalyse tool"
are both already named and "in ontwikkeling" — in development), **there is currently no dedicated
drafting/authoring AI tool defined for inkoopbeleid.** The only concrete AI tie-in that exists today is a
separate, narrower tool for tracking legal/regulatory changes ("Update wetgeving / Aedes" — Aedes being
the Dutch trade association for housing corporations). The actual "help me draft and maintain our
procurement policy" tool is an open slot in the roadmap.

**That gap is, quite plausibly, exactly why this piece was handed to you.** It's not that you're missing
something obvious in the source material — this genuinely is one of the least-finished parts of the plan,
and defining it is real, open work.

---

## 5. Glossary

| Dutch term | Plain English |
|---|---|
| Inkoop | Procurement / purchasing — "anything with an invoice behind it" |
| Inkoopbeleid | Procurement policy — the rulebook this whole document is about |
| Opdrachtgeverschap | Being a good "client" — how you behave as the party hiring/buying |
| Aanbesteden / aanbesteding | Tendering — publicly inviting suppliers to compete for a contract |
| Gunning | Contract award — the decision of who wins a tender |
| Leverancier | Supplier |
| Drempelbedragen | Threshold amounts — the euro cutoffs that decide which procedure applies |
| Geschiktheidseisen | Suitability requirements — the minimum bar to be allowed to bid at all |
| Categoriemanagement | Category management — grouping related purchases and managing them as one strategy |
| Pas toe of leg uit | Comply or explain — follow the rule, or write down why you didn't |
| MT(-lid) | Management team (member) — a named approval gate at certain euro thresholds |
| Adviseur inkoop | Procurement advisor — a specialist role that must be looped in above certain thresholds |
| Contracteigenaar | Contract owner — the manager of the department the contract's budget belongs to |
| Woningcorporatie | Housing corporation — a non-profit landlord providing affordable housing (the type of client in both real examples here) |
| Aedes | The Dutch trade association for housing corporations |

---

## 6. What this probably means for you as a builder

Not a spec — just the obvious shape this points toward, for when you're ready to design the actual
feature:

- **Content, not just text**: an inkoopbeleid isn't one blob of text — it has a recognizable structure
  (Section 2's 10-part shape), goals that vary per organization, and structured rules (thresholds → quotes
  required → documents required → who approves) that other parts of the platform will want to *query*,
  not just display.
- **A workflow, not a one-shot form**: the 5 steps in Section 3 are a real drafting/review/approval
  process with distinct stages — worth modeling as actual state, not just a static document upload.
- **A dependency, not an island**: whatever you build should be able to (eventually) receive the vision
  document (0.1) as input and hand its own output forward to the annual plan (0.3) and to Rooms 2.1, 2.2,
  and 4 — so think about this as a piece with defined inputs/outputs, not a standalone form.
- **The AI piece is genuinely open**: there's a clearly stated intent (a document-grounded advisor) but no
  existing tool to copy — which means this is a real design decision, not a "go implement the spec"
  ticket.

When you're ready to turn this into an actual technical plan against the battlestack codebase, that's a
separate, focused conversation — happy to help with that once the domain side above has settled in.
