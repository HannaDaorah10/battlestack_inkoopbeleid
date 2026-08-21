# Inkoopbeleid — technical deep-dive & build reference

This is the technical companion to `inkoopbeleid.md`. That file explains the business idea in simple
terms; this file holds the precise data, rules, and tech-stack detail that got simplified away there —
the stuff you need to actually build the thing, not just understand it in conversation.

**How to use this file**: if you (or a future session) need to pick this project back up, read this file
plus `inkoopbeleid.md` plus `REPO.md` (in that order) and you'll have full context — the business domain,
the exact rules, and the codebase this gets built on.

---

## 0. Project status snapshot

- **Template decided**: `nuxt4-ai` (Nuxt 4 + Postgres/Drizzle + auth + Mastra AI agents + streaming chat +
  opt-in RAG on pgvector). Reason: the inkoopbeleid module needs a document-grounded AI advisor, which is
  exactly what this template's RAG feature provides.
- **Not yet scaffolded**: no `npx battlestack@latest` run has happened yet. Everything below about "your
  app" describes what you'll get *once* you scaffold — it doesn't exist as running code yet.
- **RAG tuning decided**: chunk size ~700–800 tokens / ~100 overlap recommended for inkoopbeleid documents
  (vs. the app's built-in default of 512/50) — see §3.2.
- **Docs produced so far**: `REPO.md` (codebase overview), `inkoopbeleid.md` (business explainer), this
  file — all in the repo root.
- **Source PDFs** (in `C:\Users\Vibecoding\Downloads`, not in the repo): `Inkoopwijzer_2023.pdf`,
  `Inkoopbeleid Ons Huis 2025-2028-def.pdf`, `Adjust Inkoophuis.pdf`. A fourth document named in the
  Adjust framework as a reference for this exact task, `Ymere Inkoopbeleid 2024 DEFINITIEF.docx`, has
  **not** been supplied yet.

---

## 1. The exact rules your app needs to encode

`inkoopbeleid.md` simplified these for readability. Here they are at full precision, because a real
implementation needs the exact numbers, not the gist.

### 1.1 Current (2025–2028) tender-procedure thresholds — Ons Huis, Chapter 6

All amounts **include VAT** and cover the **entire contract lifetime**. For a recurring annual contract,
multiply the annual value **×4** to find the applicable tier.

**Werken (Works / construction):**

| Contract value | Procedure | Min. quotes | Extra requirement |
|---|---|---|---|
| ≥ €2,000,000 | Meervoudig onderhands (restricted) | 3 | Full category management |
| €500,000 – < €2,000,000 | Meervoudig onderhands | 3 | Strategy + award-advice document |
| €100,000 – < €500,000 | Meervoudig onderhands | 3 | Award-advice document only |
| < €100,000 | Enkelvoudig onderhands (direct) | 1 | Just record the RFQ + quote |

*(The source table literally prints the third row's upper bound as "> €500.000" — almost certainly a
typo for "< €500.000" given the surrounding pattern. Flag this if you ever see it reproduced elsewhere.)*

**Diensten en leveringen (Services & Supplies):**

| Contract value | Procedure | Min. quotes | Extra requirement |
|---|---|---|---|
| ≥ €250,000 | Meervoudig onderhands | 3 | Full category management |
| €50,000 – < €250,000 | Meervoudig onderhands | 2 | Strategy + award-advice document |
| €25,000 – < €50,000 | Meervoudig onderhands | 2 | Just record the RFQ + quotes |
| < €25,000 | Enkelvoudig onderhands | 1 | Just record the RFQ + quote |

Works is stricter (always ≥3 quotes) than Services/Supplies (drops to 2 at lower tiers).

### 1.2 Legacy/fallback thresholds — Ons Huis, Appendix 2 (still live for unmigrated categories)

A simpler 3-tier system, no Works/Services split:

| Procedure | Value | Parties |
|---|---|---|
| Aanbesteding (full tender) | ≥ €100,000 | 3+ |
| Offerteprocedure (quote procedure) | €15,000 – €100,000 | 2+ |
| Eén op één (sole-source) | < €15,000 | 1 |

**Important technical nuance — two systems coexist on purpose**: §1.1 (new) governs *which tender
procedure to run*. This §1.2 table's real job today is different — it still governs a separate dimension:
**who is authorized to sign off**, via the mandate table below. A real implementation needs to model
*procedure selection* and *signing authority* as two independent rule sets, because the policy explicitly
keeps them that way during its transition period.

**Full signing-authority / mandate table** (Appendix 2, dated 15 Dec 2021, all amounts incl. VAT):

| Role | Department | Ceiling | Scope |
|---|---|---|---|
| Directeur-bestuurder (CEO) | — | €1,000,000 | everything |
| Manager vastgoed | Vastgoed | €100,000 | real estate |
| Projectleider vastgoedontwikkeling/vastgoed | Vastgoed | €50,000 | real estate |
| Projectleider installaties en onderhoud / Technisch medewerker vastgoed | Vastgoed | €15,000 | maintenance contracts |
| Manager bedrijfsbeheer | Bedrijfsbeheer | €50,000 | general |
| Coördinator ICT | Bedrijfsbeheer | €15,000 | ICT |
| Secretaresse/Directie-assistent | Bedrijfsbeheer/Staf | €2,500 | facilities |
| Manager wonen | Wonen | €50,000 | tenants, general |
| Teamleider wonen / Technisch consulent | Wonen | €15,000 | maintenance, home improvement |
| Coördinator/Medewerker KCC | Wonen | €5,000 | daily maintenance |
| Verhuur- en verkoopmakelaar | Wonen | €10,000 | tenant service contracts, brokerage |
| Wijkbeheerder | Wonen | €1,000 | tenant service contracts |
| All other roles (except finance staff) | — | €250 | general |

Plus: full tenders expected to exceed **€1,000,000** need advance approval from the **Raad van
Commissarissen** (RvC — Supervisory Board), notably the same figure as the CEO's own ceiling.

**Other hard rules worth encoding as validation logic, not just documentation:**
- **Anti-splitting rule**: you may not break one purchase into smaller pieces just to duck under a
  threshold. (If you ever build automated threshold-checking, this implies checking *cumulative* spend
  with a supplier/category, not just one transaction.)
- **Contract register**: any obligation ≥ €20,000/year lasting >1 year must be logged centrally.
- **Change-order authority**: a project leader can approve extra/reduced work up to 10% of the contract
  sum or €15,000 (whichever applies) without separate pre-approval.
- **Contract duration guideline**: 3 years + one optional 3-year extension (~6 years max); recurring
  services get fully re-tendered every 3–6 years regardless.
- **Deviation form**: any departure from the prescribed procedure needs a specific form ("Format
  afwijking van de inkoopprocedure") with project leader, expected spend, justification, and signatures —
  and if expected spend is >€100,000, the CEO personally signs; if >€50,000 for real-estate projects, the
  CEO or Manager Vastgoed.

### 1.3 Category management cycle — the 7-phase "categoriedossier"

Used in full for big-ticket categories (Services/Supplies ≥ €250k, Works ≥ €2M). Mapped onto a
**Plan-Do-Check-Act (PDCA)** cycle, each phase capped at one page:

| PDCA quadrant | Phase | Contents |
|---|---|---|
| Plan | 1. Quickscan | What contracts exist, what falls outside them, satisfaction on both sides |
| Plan | 2. Startdocument | Recommendation to launch, who's involved, rough 1-page plan |
| Plan | 3. Categorieplan | Market + internal analysis, goals 1–5 years out |
| Do | 4. Inkoopstrategie | Market approach, longlist, award/selection criteria + weighting |
| Do | 5. Gunningsadvies | Tender summary, evaluation, outcome, recommended term + risk controls |
| Check | 6. Contractkaart | 1-page summary of key terms + who's responsible |
| Act | 7. KPI update | Results vs. KPIs, improvement agreements, advice to contract owner |

This is a genuinely reusable pattern: if your app models "a category" as an entity, this 7-phase structure
is close to its natural state machine.

### 1.4 Organizational roles (Ons Huis's inkooporganisatie, Chapter 7)

| Role | Function |
|---|---|
| **MT (Management Team)** | Approves the policy itself, terms & conditions, contract templates, procurement calendar; discusses strategies; sets KPIs; checks *process quality*, not decision content |
| **Contracteigenaar (Contract owner)** | The budget-holding department's manager — the real "client" for a contract |
| **Adviseur inkoop (Procurement advisor)** | Ensures MT decisions get executed; mandatory involvement above the category-management thresholds (§1.1's top tier) |
| **Inkopers in lijnafdelingen** | Anyone buying "in the name of their function" — executes category management day to day |
| **Contractmanagers in lijnafdelingen** | Manage/execute contracts relevant to their department |
| **Inkoop intelligence** | Central team: registers contracts, produces reporting/analysis |

### 1.5 The organization's procurement goals — structured shape

`inkoopbeleid.md` already shows Welbions's 6 goals vs. Ons Huis's 4 goals side by side, with the lesson
that this list is **not standardized** across organizations. Technically, this means goals should be
modeled as **editable, per-organization data** — not a hardcoded enum — and each goal likely needs at
least: a name, a short description, and (per Ons Huis's own instruction) a note that each business area
translates the goal into SMART targets in its own category plan, i.e., goals may need a
one-to-many relationship to concrete, measurable targets per category.

---

## 2. Precise mapping onto the Adjust Inkoophuis framework

### 2.1 The 0.2 step sequence as a workflow/state machine

The 5 steps map naturally onto a linear approval workflow:

```
0.2.1 Analyse       0.2.2 Herijken        0.2.3 Opstellen      0.2.4 Bespreken      0.2.5 Vaststellen
(review existing) → (rework principles   → (draft the        → (review the       → (formal approval —
                     with stakeholders)     policy text)        draft)              becomes official)
```

If you build this as real application state (rather than just a document upload), each step is a
plausible status value, and steps 0.2.2 and 0.2.4 imply a **multi-party review** mechanism (comments,
sign-off tracking per stakeholder), not just a single author writing a file.

### 2.2 Full "Relevante input" data-feed lists — all 4 Fundament blocks

This is the exact list of documents each Foundation block is meant to be grounded on. It matters because
this is literally the **RAG ingestion input list** — what needs to be uploadable/queryable per block once
the "digital advisor" exists.

| Block | Relevante input (documents to feed the AI advisor) |
|---|---|
| **0.1 Visie** | Ondernemersplan/Jaarplan (org goals & strategy); Interne audit/managementletter; MT-ambities |
| **0.2 Inkoopbeleid** | **Huidige inkoopbeleid** (current policy); Ondernemersplan/Jaarplan; Interne audit/managementletter; MT-ambities; **Visie op opdrachtgeverschap** (0.1's own output) |
| **0.3 Jaarplan** | Huidig jaarplan; Interne audit/managementletter; MT-ambities; **Inkoopvolwassenheid** (Room 1's output) |
| **0.4 Categoriemanagement** | *(none listed yet in the source deck — least-developed block)* |

Note the two cross-references: 0.2 explicitly consumes 0.1's output, and 0.3 explicitly consumes both an
earlier-room output (maturity score) and implicitly 0.1+0.2 (confirmed on a separate slide, p.33, listing
"Inkoopvisie, -doelen en beleid" as a direct input to the annual plan).

### 2.3 Downstream consumers — what 0.2's output needs to expose

Other rooms don't just reference inkoopbeleid conceptually — they reuse it as working material:

- **Room 2.1 (Processes)**: "draft procurement policy" is literally a named step of a mature Strategic
  Procurement Process; tactical-process design lists "current procurement policy" as its first input.
- **Room 2.2 (Organization)**: both the staff **training curriculum** and **role/job profiles** cite the
  existing policy as reference material.
- **Room 4 (Sturing/steering)**: inkoopbeleid is one of four named Foundation inputs feeding steering and
  reporting.
- **Adjust's own client-diagnostic process**: reviewing a client's current inkoopbeleid is the **first**
  document type assessed when onboarding any new client.

Technical implication: whatever you build shouldn't be a dead-end document viewer. At minimum, think
about the policy's *content* (goals, rules, thresholds) being structured enough that other future modules
(a process-design tool, a training-curriculum tool, a dashboard) could plausibly query or reference it
later — even if you don't build those consumers now.

### 2.4 Maturity-model scoring mechanics

The Adjust Inkoopvolwassenheidsmodel© scores an organization on 5 levels (Gefragmenteerde →
Gestructureerde → Gecoördineerde → Geïntegreerde Toeleveringsketen → Geoptimaliseerde Waardeketen) across
**6 dimensions**: Beleid/Doelstellingen & Strategie, Processen & Procedures, Personeel & Organisatie,
Methoden & Communicatie, Systemen, Leveranciers. Inkoopbeleid quality is the primary driver of the first
dimension. Technical implication: if the platform ever surfaces a maturity score, your module may need to
expose some kind of "completeness" or "quality" signal (e.g., are all chapters filled in? is it within its
review date? are thresholds defined?) that a scoring feature elsewhere could read.

### 2.5 The AI-advisor gap — precisely

From the "Stapstenen professionaliseren" / "AI-oplossingen per item" pages, here's the actual state of
AI tooling across the roadmap (🤖 = has a named tool):

| Stage | Item | Mapped AI tool | Status |
|---|---|---|---|
| 1. Voorbereiding | Uitvoeren Inkoop en CLM scan | Quickscan tool | in ontwikkeling |
| 2. Inzicht en ambitie | Uitgaven inzichtelijk (spendanalyse) | Spendanalyse tool | in ontwikkeling |
| 3. Basis op orde | Start contractmanagement | CM-plan assistent | named |
| **3. Basis op orde** | **Inkoop en CLM beleid** | **"Update wetgeving / Aedes"** | named, but scoped to legal/regulatory monitoring only |
| 1. Voorbereiding | Deskresearch (doelen, plannen, beleid) | Marktanalyse | named, touches policy docs only during early client intake |

**No entry exists for "draft/maintain the policy text itself" with AI assistance.** That's the literal
gap. The only two AI touchpoints inkoopbeleid currently has are (a) a narrow legal-change monitor, and
(b) a generic market-research tool used once during initial client intake. A document-grounded drafting/
Q&A assistant — using the "Relevante input" list in §2.2 as its grounding corpus — is planned in spirit
(every Fundament block has a "Digitale adviseur" flag) but has no concrete design yet. That's the open
slot this whole project is aimed at filling.

---

## 3. The tech stack you'll build on (`nuxt4-ai` template)

### 3.1 What scaffolding gives you out of the box

- **Frontend**: Nuxt 4, Nuxt UI v4, Tailwind v4, i18n (EN + NL), Pinia, PWA.
- **Data layer**: Postgres + Drizzle ORM, running in Docker; `db:push`, `seed`, `studio`, `shell` commands.
- **Auth**: custom session auth (argon2id password hashing), optional passkeys (WebAuthn), optional TOTP
  2FA, password recovery, email verification, GitHub/Google OAuth.
- **AI layer**: Mastra agents behind an OpenAI-compatible AI gateway (default preset: sluis.ai — EU data
  residency, PII stripped from prompts); HTTP-streaming chat UI; opt-in RAG on pgvector.
- **App surface**: authenticated dashboard, admin-gated user management, append-only security audit log.
- **Ops**: production Dockerfile, `docker-compose.yml`, real `/api/health`, GitHub Actions CI.

### 3.2 The RAG pipeline — exact technical detail

Read directly from this repo's `packages/preset-nuxt4/templates/rag/server/utils/rag.ts` and
`packages/preset-nuxt4/src/features/rag.ts` — this is what actually gets generated into your project:

**Pipeline**:
```
MDocument.fromText(text, {title, source, ...metadata})
  → doc.chunk({ strategy: 'recursive', maxSize: <chunk size>, overlap: <overlap> })
  → embedMany({ model: <embedding model via AI gateway>, values: chunk texts })
  → PgVector.upsert({ indexName, vectors: embeddings, metadata: chunk text + title + source })
```
Query side: embed the query text the same way → vector similarity search, returns top-K chunks with
similarity scores.

**Configuration** (env-driven, prompted interactively at scaffold time):

| Setting | Env var | Default | Our recommendation for inkoopbeleid docs |
|---|---|---|---|
| Max chunk size (tokens) | `NUXT_RAG_MAX_CHUNK_SIZE` | 512 | **~700–800** — policy clauses/threshold tables need more surrounding context to stay coherent |
| Chunk overlap (tokens) | `NUXT_RAG_CHUNK_OVERLAP` | 50 | **~100** |
| Top-K retrieved chunks | `NUXT_RAG_TOP_K` | 5 | 5 is a reasonable starting point |
| Embedding dimensions | (set at scaffold) | 1536 | leave as-is unless you change embedding model |
| Embedding model | (set at scaffold) | `openai/text-embedding-3-small` (via gateway) | leave as-is unless you have a reason not to |

Chunking strategy is `'recursive'`: it tries to split on natural boundaries (headings, paragraphs) first,
and only falls back to smaller units if a chunk is still too big — this is why a larger max size is safe
for structured documents like the Ons Huis policy (§1's tables and numbered clauses).

**API surface**:
- `POST /api/rag/ingest` — body `{ title, source, text, metadata? }`
- `POST /api/rag/query` — body `{ query }` → returns top-K chunks with similarity scores
- Both require an authenticated session.

**UI**: `/dashboard/rag` — an ingest form + query box, under the Admin nav, gated by the `rag` feature
flag.

**Agent**: `server/mastra/agents/rag.ts` — same underlying gateway chat model as the app's `default`
agent, but with its own system prompt tailored to answering from retrieved chunks.

### 3.3 Applied-AI-stack glossary (as distinct from the business glossary in `inkoopbeleid.md`)

| Term | Plain meaning |
|---|---|
| **RAG** (Retrieval-Augmented Generation) | Instead of an AI model answering purely from what it was trained on, you first search your own documents for relevant snippets, then hand those snippets to the model as context so its answer is grounded in your actual data. |
| **Embedding** | A numerical representation of a piece of text (a list of numbers) that captures its meaning, so "similar meaning" text ends up with "similar numbers" — this is what makes searching by *meaning* (not just keyword) possible. |
| **Vector database / pgvector** | A database built to store embeddings and quickly find the closest ones to a given query — pgvector is a Postgres extension that adds this capability, so you don't need a separate database product. |
| **Chunk / chunking** | A long document gets split into smaller pieces ("chunks") before embedding, because embeddings work better on focused pieces of text than on entire documents at once. |
| **Token** | Roughly ¾ of a word on average (not a whole word, not a character) — the unit AI models actually process text in, and the unit chunk size is measured in here. |
| **AI gateway** | A single proxy endpoint that all AI calls go through, instead of calling OpenAI/Anthropic/etc. directly — lets you swap models, add compliance controls (like PII stripping), and track usage centrally. |
| **Mastra** | The AI-agent framework this stack uses to define "agents" (a system prompt + a model + optional tools) and pipelines like the RAG one above. |
| **Drizzle** | The ORM (Object-Relational Mapper) used to define database tables in TypeScript and generate/run migrations, instead of writing raw SQL by hand. |
| **Migration** | A versioned, tracked change to the database schema (e.g., "add a table") that can be applied once and safely re-run without duplicating the change. |
| **SSR** (Server-Side Rendering) | Nuxt renders pages on the server before sending them to the browser, rather than shipping an empty page and building it entirely in JavaScript client-side. |
| **Feature flag / gated** | A feature (like the RAG dashboard) only appears/works if it was enabled at scaffold time — the generated code checks a flag rather than every feature always being present. |

### 3.4 What you are *not* building

Important distinction: `packages/preset-nuxt4` in this repo (the `defineBattlestackPlugin` / `Feature`
system covered in `REPO.md` and `ARCHITECTURE.md`) is the machinery **battlestack itself** uses to
scaffold *new* projects with reusable, versioned building blocks. **You are not writing a battlestack
plugin or Feature.** You will run `npx battlestack@latest` **once** to generate a single Inkoophuis
project, and then build the inkoopbeleid module as ordinary application code *inside* that generated
project — a dashboard page under `app/pages/`, API routes under `server/`, database tables via a Drizzle
schema file, and probably a dedicated Mastra agent alongside `server/mastra/agents/rag.ts`. If a genuine
need later arises to make "inkoopbeleid support" a reusable, installable feature for *other* battlestack
projects, that's a separate, much bigger undertaking than this assignment.

---

## 4. Open design questions (not yet decided — flag for a future session)

- **Database schema**: no table design exists yet for storing policy documents, their versions, or
  workflow state (§2.1's 5 steps). Needs its own design pass.
- **Workflow as real state vs. informal process**: whether 0.2.1–0.2.5 should be literal tracked
  application state (with statuses, timestamps, per-stakeholder sign-off) or just a looser drafting flow.
- **Structured rules vs. document text**: whether goals/thresholds/roles (§1) become queryable structured
  data (enabling automated threshold-checking, dashboards, etc.) or stay as text inside a document — a
  much bigger scope decision than it first sounds.
- **Dedicated Mastra agent**: whether inkoopbeleid gets its own agent (mirroring `rag.ts`'s agent) with a
  system prompt tuned for policy drafting/Q&A, versus reusing the generic RAG agent as-is.
- **Missing reference document**: `Ymere Inkoopbeleid 2024 DEFINITIEF.docx` hasn't been supplied — a third
  real-world comparison point, worth asking for if you want to validate §1's rules generalize beyond Ons
  Huis's specific numbers.

None of this needs to be resolved to keep reading/understanding the project — it's listed here so a
future session knows what's genuinely undecided versus already settled.
