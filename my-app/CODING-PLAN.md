# CODING-PLAN.md — building the Inkoopbeleid module

Everything you need to start coding, in order. Read this once from top to bottom, then work
phase by phase. You should not need to reopen `inkoopbeleid.md`, `inkoopbeleid-technical.md`
or `REPO.md` while building — the parts that matter are copied in here.

---

## 1. What we are building

### The problem in plain words

A **woningcorporatie** (a Dutch non-profit housing landlord) buys a lot of things: roofs,
cleaning, software, construction. Without rules, everyone buys differently. So they write an
**inkoopbeleid** — a procurement policy. It is an internal rulebook that says things like
*"if a purchase costs more than €50.000, you need 2 competing quotes and a manager's signature."*

Writing and maintaining that rulebook is slow, manual consulting work today. Our company's
platform roadmap says every foundation block should get a **"digitale adviseur"** — an AI advisor
grounded in the client's own documents. For inkoopbeleid, **that tool does not exist yet**. Building
it is the assignment.

### The three slices we are building

| Slice | What it does | Why it matters |
|---|---|---|
| **1. Documents** | Upload the client's PDF/DOCX policy documents, turn them into searchable text | The advisor is useless without grounding material |
| **2. Advisor** | Ask a question in Dutch, get an answer built from those documents, with sources. Also drafts policy chapters. | This is the actual gap in the roadmap |
| **3. Rules** | Store goals, thresholds and mandates as real data, and answer *"what procedure applies to my €30.000 purchase?"* | The brief insists the content must be **queryable**, not just displayed |

The brief is explicit about two things, so keep them in mind the whole way:

> **"Content, not just text"** — thresholds, goals and roles must be structured data other modules
> can query, not paragraphs inside a blob.
>
> **"A workflow, not a one-shot form"** — a policy moves through 5 stages before it is official.

### Who uses it

- **Adviseur inkoop** (procurement advisor) — the main user. Drafts and maintains the policy.
- **MT-lid / directeur-bestuurder** — reviews and formally approves it.
- **A regular employee** — just wants to know "what do I have to do for *this* purchase?"

### Dutch words you must know

| Dutch | English |
|---|---|
| Inkoop | Procurement / purchasing |
| Inkoopbeleid | Procurement policy — the rulebook we are digitising |
| Drempelbedragen | Threshold amounts — the euro cut-offs that decide which procedure applies |
| Werken | Works — construction purchases (stricter rules) |
| Diensten en leveringen | Services and supplies (looser rules) |
| Pas toe of leg uit | Comply or explain — follow the rule, or write down why you didn't |
| Mandaat | Signing authority — how much euro a given role may approve alone |
| Adviseur inkoop | Procurement advisor — must be involved above certain amounts |
| Contracteigenaar | Contract owner — the manager whose budget pays |
| Categoriemanagement | Category management — grouping related purchases into one strategy |
| Woningcorporatie | Housing corporation — our client type |

### Decisions already made (don't re-litigate these)

- **Multi-organisation from day 1.** Every row carries an `organisationId`. The brief says goals are
  "editable per organization, not hardcoded", and we want to demo two clients side by side.
- **Dutch UI first**, English keys added at the end. The app's default locale is already `nl`.
- **Money is stored as `bigint` cents.** Never floats. `€30.000` is `3000000`.
- **Procedure rules and signing rules are two separate tables.** The real policy keeps them
  independent on purpose during its transition period. Don't merge them.
- **We are NOT writing a battlestack plugin.** This is ordinary app code inside `my-app/`.

---

## 2. What you already have — do not rebuild it

This scaffold gives you a lot. Copy these files instead of inventing your own.

| You need | It already exists here |
|---|---|
| Login, sessions, admin role gate | `server/utils/auth.ts`, `app/middleware/admin.ts` |
| File upload to storage | `server/api/files/upload-url.post.ts`, `app/composables/useS3Upload.ts`, `app/components/FileUpload.vue` |
| RAG: chunk → embed → store | `server/utils/rag.ts` |
| Simplest possible API route | `server/api/rag/ingest.post.ts` (12 lines) |
| Create route (validation, duplicates, audit) | `server/api/users/index.post.ts` |
| Update route (`[id].put.ts`) | `server/api/ai/configs/[id].put.ts` |
| Page with a form + toasts | `app/pages/dashboard/rag.vue` |
| Page with a table + filters | `app/pages/dashboard/users/index.vue` |
| AI agent definition | `server/mastra/agents/default.ts` |
| Streaming an agent's answer | `server/routes/_ws.ts` |
| Admin-editable system prompts | `server/utils/prompts/defaults.ts` |
| Rich text editor | `<UEditor>` + `<UEditorToolbar>` — Nuxt UI v4, TipTap-backed, already installed |
| Seed data | `server/database/seeds/004-ai-model-configs.ts` |
| API tests | `test/e2e/api/ai.test.ts`, helpers in `test/helpers/setup.ts` |

Database access is deliberately plain: `import { db } from '#server/database/client'` and use the
Drizzle query builder directly in the route. There is **no** repository layer, **no** `useDrizzle()`
helper, and **no** `schema/index.ts` barrel file — import each schema file directly.

---

## 3. Phase 0 — make the machine work before writing any code

Half a day. Do not skip this. Three things are broken in the fresh scaffold.

### Start everything

```bash
battlestack up          # postgres + mailpit + rustfs + redis
battlestack db:push     # create the tables
battlestack db:seed     # create the admin user
battlestack dev         # start the app
battlestack login       # opens a magic link as the seed admin
```

### Blocker 1 — the AI gateway key is empty

`NUXT_AI_GATEWAY_KEY=` in `.env` is blank. `gatewayConfigError()` fails closed, so **chat and RAG
both return `gateway-key-missing`** until you paste a real `sk_live_...` key.

Nothing AI-shaped works until you fix this. Do it first.

### Blocker 2 — the vector size is wrong

`.env` says `NUXT_RAG_EMBEDDING_DIMENSIONS=2048`, but the embedding model resolves to
`openai/text-embedding-3-small`, which returns **1536** numbers. Worse, `ensureIndex()` in
`server/utils/rag.ts` swallows the error:

```ts
_initPromise = getStore(cfg)
    .createIndex({ indexName: INDEX_NAME, dimension: cfg.embeddingDimensions })
    .catch(() => {
        // Index already exists, ignore     ← this also hides a dimension mismatch
    })
```

So it fails **silently** and only shows up later as a confusing upsert error.

Fix:

```bash
# 1. in .env
NUXT_RAG_EMBEDDING_DIMENSIONS=1536

# 2. drop the bad index
battlestack db:psql
DROP TABLE IF EXISTS rag_vectors;
\q

# 3. restart the dev server
```

### Blocker 3 — there are no migrations yet

`server/database/migrations/` does not exist. The project has only ever been `db:push`ed.
Your first `pnpm run db:generate` creates the folder. **Commit the generated `.sql` file and
`meta/_journal.json` every single time you change the schema.** A schema edit without its
migration is incomplete work.

### The gate

Go to `/dashboard/rag`. Paste a paragraph, ingest it, then query it. **You must get a result back
with a similarity score.** If you don't, fix it now — every later phase depends on this working.

Also open `/chat` and send a message. If it answers, the gateway key is good.

---

## 4. The data model

One new file: `server/database/schema/inkoopbeleid.ts`. Eight tables.

```ts
// Sketch, not final code — write it properly, with the conventions from schema/ai.ts.
// uuid primary keys, snake_case columns, createdAt/updatedAt, explicit onDelete.

organisations      id, name, slug (unique), createdAt

policies           id, organisationId → organisations
                   title, periodStart, periodEnd
                   status: 'analyse' | 'herijken' | 'opstellen' | 'bespreken' | 'vastgesteld'
                   version, createdAt, updatedAt

policy_chapters    id, policyId → policies
                   number (1..10), key, title, contentMarkdown, updatedAt

policy_goals       id, policyId → policies
                   name, description, sortOrder

policy_documents   id, organisationId, policyId (nullable), fileId → files
                   title, sourceLabel
                   kind: 'huidig_inkoopbeleid' | 'visie' | 'ondernemersplan'
                       | 'audit' | 'mt_ambities' | 'referentie'
                   chunkCount, ingestedAt

thresholds         id, organisationId
                   ruleSet: 'current' | 'legacy'
                   purchaseType: 'werken' | 'diensten_leveringen' | 'any'
                   minAmountCents (bigint), maxAmountCents (bigint, nullable = no upper bound)
                   procedure, minQuotes, extraRequirement

mandates           id, organisationId
                   roleName, department, ceilingAmountCents (bigint), scope

policy_reviews     id, policyId, chapterId (nullable), userId → users
                   comment, decision: 'comment' | 'approve' | 'reject', createdAt
```

Why it looks like this:

- **`policies.status`** is the 5-step workflow (0.2.1 Analyse → 0.2.2 Herijken → 0.2.3 Opstellen →
  0.2.4 Bespreken → 0.2.5 Vaststellen). One column, real state, cheap.
- **`policy_chapters`** is the fixed 10-section template every real inkoopbeleid follows:
  1. Toepassing · 2. Opdrachtgeverschap · 3. Inkoopdoelen · 4. Beleidskaders en spelregels ·
  5. Categoriemanagement · 6. Procedures en drempelbedragen · 7. Inkooporganisatie ·
  8. Realisatie van doelstellingen · 9. Inkoopproces en overgangsperiode · 10. Bijlagen
- **`thresholds` and `mandates` are separate on purpose.** Thresholds decide *which tender procedure
  to run*. Mandates decide *who may sign*. The real policy keeps these independent.
- **`policy_reviews`** covers steps 0.2.2 and 0.2.4, which need multiple people commenting and
  signing off — not one author editing a file.

### The real numbers to seed (Ons Huis, 2025–2028)

All amounts **include VAT** and cover the **whole contract**, not one year. For a recurring annual
contract, multiply the yearly value **×4** to find the tier.

**Werken** (construction):

| Contract value | Procedure | Min. quotes | Extra requirement |
|---|---|---|---|
| ≥ €2.000.000 | Meervoudig onderhands | 3 | Full category management |
| €500.000 – < €2.000.000 | Meervoudig onderhands | 3 | Strategy + award-advice document |
| €100.000 – < €500.000 | Meervoudig onderhands | 3 | Award-advice document only |
| < €100.000 | Enkelvoudig onderhands | 1 | Record the RFQ + quote |

**Diensten en leveringen** (services and supplies):

| Contract value | Procedure | Min. quotes | Extra requirement |
|---|---|---|---|
| ≥ €250.000 | Meervoudig onderhands | 3 | Full category management |
| €50.000 – < €250.000 | Meervoudig onderhands | 2 | Strategy + award-advice document |
| €25.000 – < €50.000 | Meervoudig onderhands | 2 | Record the RFQ + quotes |
| < €25.000 | Enkelvoudig onderhands | 1 | Record the RFQ + quote |

> The source PDF prints the third Werken row's upper bound as "> €500.000". That is almost certainly
> a typo for "< €500.000". **Encode `<` and leave a code comment saying why.**

**Mandates** (who may sign what, all incl. VAT):

| Role | Department | Ceiling |
|---|---|---|
| Directeur-bestuurder | — | €1.000.000 |
| Manager vastgoed | Vastgoed | €100.000 |
| Manager bedrijfsbeheer | Bedrijfsbeheer | €50.000 |
| Manager wonen | Wonen | €50.000 |
| Projectleider vastgoed | Vastgoed | €50.000 |
| Coördinator ICT | Bedrijfsbeheer | €15.000 |
| Teamleider wonen | Wonen | €15.000 |
| Verhuur- en verkoopmakelaar | Wonen | €10.000 |
| Coördinator/medewerker KCC | Wonen | €5.000 |
| Secretaresse / directie-assistent | Staf | €2.500 |
| Wijkbeheerder | Wonen | €1.000 |
| Everyone else | — | €250 |

Tenders above €1.000.000 also need advance approval from the **Raad van Commissarissen**.

---

## 5. The build order

Six phases. Each one ends in something you can actually look at. Stop at each **CHECKPOINT**.

The house rule for every feature is: **schema → API → page → i18n → tests**. Follow that order
inside each phase too.

### Phase 0 — machine works (½ day)

Section 3 above. Done when RAG ingest + query returns a result and `/chat` answers.

---

### Phase 1 — database foundation (1 day)

**Goal:** the tables exist, two organisations are seeded, and there is a page in the nav.

Files:
- `server/database/schema/inkoopbeleid.ts` — the eight tables
- `server/database/seeds/005-inkoopbeleid.ts` — seed **Ons Huis** and **Welbions** as organisations,
  plus the Ons Huis thresholds and mandates from section 4
- `nuxt.config.ts` — add `inkoopbeleid: true` to `runtimeConfig.public`
- `app/layouts/default.vue` — add a nav entry gated on that flag
- `i18n/locales/nl/inkoopbeleid.json` + `i18n/locales/en/inkoopbeleid.json` (new namespace,
  auto-registered — just create both files)
- `i18n/locales/{nl,en}/shell.json` — add `shell.inkoopbeleid` + `shell.inkoopbeleidHint`
- `app/pages/dashboard/inkoopbeleid/index.vue` — an overview page listing policies

Verify:
```bash
pnpm run db:generate     # creates server/database/migrations/ — commit the SQL
battlestack db:push
battlestack db:seed
pnpm run lint
```
Then open `/dashboard/inkoopbeleid` and see your two organisations.

> **CHECKPOINT** — the schema is the hardest thing to change later. Look at it properly before moving on.

---

### Phase 2 — documents in, text out (1–2 days)

**Goal:** upload a real policy PDF and have it become searchable, scoped to one organisation.

Add two packages:
```bash
pnpm add unpdf mammoth
```
(`unpdf` reads PDFs and works inside Nitro. `mammoth` reads .docx. If pnpm refuses because the
version is too new, add `--no-minimum-release-age`.)

Files:
- `server/api/files/upload-url.post.ts` — add the DOCX MIME type to `ALLOWED_MIME_TYPES`:
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  (`application/pdf` is already allowed)
- `server/utils/inkoopbeleid/extract.ts` — bytes + mime → plain text. Keep it a pure function so
  you can unit-test it.
- `server/utils/rag.ts` — **add a `filter` parameter to `queryText()`**. Right now it takes only a
  query string and searches one global index called `rag_vectors` shared by everything. Pass
  `organisationId` in the ingest metadata and filter on it at query time, or your two demo
  organisations will contaminate each other's answers.
- `server/api/inkoopbeleid/documents/index.post.ts` — upload → extract → `ingestText()` with
  `metadata: { organisationId, documentKind, policyId }` → save a `policy_documents` row
- `server/api/inkoopbeleid/documents/index.get.ts` — list documents for an organisation
- `app/pages/dashboard/inkoopbeleid/documenten.vue` — upload form + list, copying
  `app/pages/dashboard/rag.vue` for the form and toast pattern

Verify: upload the Ons Huis PDF, see a chunk count, then query it and get sensible Dutch text back.

> Watch the threshold **tables** in the PDF. They are the highest-value content and the most likely
> to come out mangled. Read the extracted text of chapter 6 with your own eyes before trusting it.

---

### Phase 3 — the advisor (2 days)

**Goal:** ask a Dutch question, get an answer built from the uploaded documents, with sources.

This is the actual missing piece. `/api/rag/query` returns raw chunks and **never calls an LLM** —
retrieve-then-generate does not exist in this codebase yet. You are writing it.

Registering an agent takes **four** touch points, not one:

1. `server/mastra/agents/inkoopbeleid.ts` — copy `server/mastra/agents/default.ts`.
   Use **relative** imports here (`../utils/agent-runtime`), not `#server/*` — the standalone
   Mastra bundler cannot resolve the alias.
2. `server/mastra/agents/registry.ts` — add an entry with
   `key: 'inkoopbeleid'`, `modelConfigKey: 'chat'`, `promptKey: 'agent.inkoopbeleid.system'`
3. `server/utils/prompts/defaults.ts` — add that prompt. Write it in Dutch. Tell it to answer only
   from the given excerpts, to say plainly when the answer isn't there, and to cite the `source`
   of every excerpt it uses.
4. `server/mastra/index.ts` — add it to the `agents: { ... }` map.
   **This step is what makes the boot plugin create its database row.** `ragAgent` is missing from
   this map, which is exactly why `mastra.getAgent('rag')` would throw today.

Then:
- `server/api/inkoopbeleid/advies.post.ts` — the retrieve-then-generate route:
  `queryText(question, { organisationId })` → build a context block from the chunks →
  `mastra.getAgent('inkoopbeleid').generate(...)` → return `{ answer, sources }`
- `server/api/inkoopbeleid/chapters/[id]/draft.post.ts` — same idea, but the prompt asks for a draft
  of one specific chapter, and the result is written into `policy_chapters.contentMarkdown`
- `app/pages/dashboard/inkoopbeleid/adviseur.vue` — question box, answer, source list
- `app/pages/dashboard/inkoopbeleid/[id].vue` — the 10 chapters with `<UEditor>` and a
  "Laat de adviseur dit hoofdstuk schrijven" button per chapter

Verify: ask *"Hoeveel offertes heb ik nodig voor een schoonmaakcontract van €30.000?"* and get a
correct Dutch answer that cites the Ons Huis document.

> **CHECKPOINT** — this is the assignment's core. Show it to someone before continuing.

---

### Phase 4 — structured rules and the checker (1–2 days)

**Goal:** *"I want to buy X for €Y"* → the exact procedure, quote count, extra documents, and who
must sign.

- `server/utils/inkoopbeleid/thresholds.ts` — a **pure function**:
  `selectProcedure({ amountCents, purchaseType, thresholds })`. No database calls inside it, so it
  is trivially unit-testable. A second pure function `findMandate({ amountCents, mandates })` returns
  the lowest role whose ceiling covers the amount.
- `server/api/inkoopbeleid/toets.post.ts` — loads the rows, calls both functions, returns the verdict
- `app/pages/dashboard/inkoopbeleid/toets.vue` — amount + type → the answer
- `test/unit/inkoopbeleid-thresholds.test.ts` — start with the two worked examples from the brief:

  | Input | Expected |
  |---|---|
  | €30.000, diensten en leveringen | Meervoudig onderhands, **2 quotes**, record RFQ + quotes, no advisor required |
  | €2.500.000, werken | Meervoudig onderhands, **3 quotes**, full category management, **adviseur inkoop mandatory** |

Also encode these as validation rules, not just prose:
- **Anti-splitting**: you may not chop one purchase into pieces to duck under a threshold. If you
  automate any checking, check *cumulative* spend per supplier/category, not one transaction.
- **Contract register**: any obligation ≥ €20.000/year lasting > 1 year must be logged centrally.
- **×4 rule**: a recurring annual contract is valued at 4× its yearly amount.

Every test needs `{ timeout: 120_000 }`.

---

### Phase 5 — workflow, comply-or-explain, polish (1–2 days)

- Status transitions on `policies` (analyse → herijken → opstellen → bespreken → vastgesteld),
  with the buttons disabled when the move isn't allowed
- `policy_reviews`: comment on a chapter, approve or reject. This is what makes steps 0.2.2 and
  0.2.4 real instead of decorative.
- **Pas toe of leg uit**: a deviation record — what rule was skipped, why, who approved it. The
  written explanation is the whole point; make the justification field required.
- A completeness signal: how many of the 10 chapters are filled, are thresholds defined, is the
  policy still inside its validity period. A future maturity-scoring module reads this.
- English translations for every key you added
- `pnpm test && pnpm run lint` — both green

---

## 6. House rules you must not break

- **Order:** schema → API → page → i18n → tests.
- **ESLint is the formatter.** 4 spaces, single quotes, **no semicolons**, trailing commas.
  Run `pnpm run lint:fix`. Lefthook blocks the commit otherwise.
- **Never `process.env` in `app/`.** Add a key to `runtimeConfig` in `nuxt.config.ts` and read it
  with `useRuntimeConfig()`. Nuxt only binds `NUXT_*` onto keys that already exist — an
  unregistered key is silently dead. The one exception is `server/mastra/**`, which boots outside
  Nitro and may read `process.env` directly.
- **Never `process.env.NODE_ENV` anywhere.** Use `import.meta.dev`.
- **`#server/*` in Nitro code, relative imports inside `server/mastra/**`.**
- **After every schema edit:** `pnpm run db:generate`, commit the SQL and `meta/_journal.json`.
- **No hardcoded strings.** Everything user-facing goes through i18n, in both `nl` and `en`.
- **No authoritative state in module variables.** The app runs as multiple replicas. If losing an
  in-memory value would make a request wrongly succeed or fail, it belongs in Postgres.
- **`{ timeout: 120_000 }` on every test.**

**Adding a page is four edits, not one:**
1. the `.vue` file under `app/pages/`
2. a `runtimeConfig.public.<flag>` key in `nuxt.config.ts`
3. a gated entry in `app/layouts/default.vue`'s `nav` computed
4. `shell.<key>` and `shell.<key>Hint` in **both** `i18n/locales/nl/shell.json` and `en/shell.json`

---

## 7. Gotchas that will cost you hours

- **`app/layouts/dashboard.vue` does not exist**, even though `AGENTS.md` says it does. Every
  dashboard page falls through to `default.vue`. Never write `definePageMeta({ layout: 'dashboard' })`.
- **Server-side rendering silently 401s** on auth-gated endpoints unless you forward the cookie:
  ```ts
  const headers = useRequestHeaders(['cookie'])
  const { data } = await useAsyncData(() => $fetch('/api/...', { headers }))
  ```
- **`/api/rag/query` returns chunks, not an answer.** No LLM is involved. You write that yourself.
- **One global vector index** (`rag_vectors`) shared by every document. Without metadata filtering,
  your two demo organisations will answer each other's questions.
- **e2e tests self-skip silently** unless `battlestack dev` is running. A green run may mean
  "nothing ran".
- **i18n JSON edits need a dev server restart** before the new keys resolve.
- **The supply-chain policy holds back brand-new package versions.** If `pnpm add` refuses, use
  `--no-minimum-release-age`.
- `server/routes/_ws.ts` (the chat socket) has **no session check**. Don't copy that part.

---

## 8. How to prompt Claude Code for each phase

You are vibe-coding, so the quality of the prompt is the quality of the code. These four templates
work well in this repo. Always name the file to imitate.

**Schema:**
> Read `server/database/schema/ai.ts` for the conventions. Create
> `server/database/schema/inkoopbeleid.ts` with the tables described in section 4 of
> `CODING-PLAN.md`. Use uuid primary keys, snake_case columns, `bigint` cents for money, explicit
> `onDelete`, and export the `$inferSelect` / `$inferInsert` types. Then run `pnpm run db:generate`.

**API route:**
> Read `server/api/users/index.post.ts` and `server/api/rag/ingest.post.ts` for the pattern. Create
> `server/api/inkoopbeleid/documents/index.post.ts`. Validate the body with zod, require a session,
> import `db` from `#server/database/client`. Follow the ESLint style: 4 spaces, single quotes, no
> semicolons.

**Page:**
> Read `app/pages/dashboard/rag.vue` for the form pattern and `app/pages/dashboard/users/index.vue`
> for the table pattern. Create `app/pages/dashboard/inkoopbeleid/documenten.vue`. All text through
> `useI18n()` — add the keys to both `i18n/locales/nl/inkoopbeleid.json` and the `en` one. Include
> loading, empty and error states. Forward cookies with `useRequestHeaders(['cookie'])`.

**Tests:**
> Read `test/e2e/api/ai.test.ts` and `test/helpers/setup.ts`. Write tests for
> `server/utils/inkoopbeleid/thresholds.ts` in `test/unit/`. Cover the two worked examples in section 5
> of `CODING-PLAN.md`, plus the exact boundary values (€25.000, €50.000, €250.000, €100.000,
> €500.000, €2.000.000). Every test gets `{ timeout: 120_000 }`.

When something breaks, ask for a **diagnosis before a fix**: *"don't change anything yet — tell me
what the root cause is and how you'd confirm it."* That one habit prevents most vibe-coding spirals.

---

## 9. Definition of done

You can demo this, in order, without touching the database by hand:

1. Log in and pick **Ons Huis** as the organisation.
2. Upload `Inkoopbeleid Ons Huis 2025-2028.pdf`. It reports a chunk count.
3. Ask the advisor, in Dutch: *"Hoeveel offertes heb ik nodig voor een schoonmaakcontract van
   €30.000?"* Get a correct answer that cites the document.
4. Open the policy, click **"Laat de adviseur dit hoofdstuk schrijven"** on chapter 6, and get a
   draft you can edit.
5. Run the checker twice: `€30.000 / diensten en leveringen` → 2 quotes.
   `€2.500.000 / werken` → 3 quotes, category management, adviseur inkoop required.
6. Move the policy from **Opstellen** to **Bespreken**, leave a review comment, then **Vaststellen**.
7. `pnpm test && pnpm run lint` — both green.

---

## Appendix — commands

```bash
battlestack up          # start postgres, mailpit, rustfs, redis
battlestack dev         # run the app
battlestack login       # magic-link login as the seed admin
battlestack db:push     # apply schema (dev)
battlestack db:seed     # seed admin + reference data
battlestack db:studio   # browse the database
battlestack db:psql     # SQL shell
battlestack test        # tests, with a live-server check first

pnpm run db:generate    # emit a migration — REQUIRED after every schema edit
pnpm run lint:fix       # format + fix
pnpm test               # vitest
pnpm run typecheck      # nuxi typecheck
```

Background reading, only if you need it: `../inkoopbeleid.md` (the domain),
`../inkoopbeleid-technical.md` (the full rule tables), `AGENTS.md` (all project conventions).
