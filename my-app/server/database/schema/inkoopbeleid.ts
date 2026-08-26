import { sql } from 'drizzle-orm'
import {
    bigint,
    boolean,
    check,
    date,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    unique,
    uuid,
} from 'drizzle-orm/pg-core'
import { users } from './users'
import { files } from './files'

/**
 * Inkoopbeleid (Dutch procurement policy) domain.
 *
 * Two rules from the brief shape every table here:
 *
 * 1. **"Content, not just text."** Thresholds, goals, mandates and procedures are rows other
 *    modules can query, never paragraphs inside a document blob. `policy_chapters` holds the
 *    prose; everything a machine has to reason about lives in its own typed column.
 * 2. **"A workflow, not a one-shot form."** `policies.status` is real state, and
 *    `policy_reviews` records the multi-party sign-off that steps 0.2.2 and 0.2.4 need.
 *
 * Multi-organisation from day one: every root row carries `organisationId`, because the brief
 * requires goals to be "editable per organization, not hardcoded" and we demo two clients
 * side by side.
 *
 * Enums are `text` columns backed by a TS enum, matching `schema/users.ts#Role` rather than
 * `pgEnum`. Same reason as there: adding a value stays an ordinary code change instead of an
 * `ALTER TYPE` migration, and the value set is already asserted by zod at every write.
 */

// --- Vocabularies -----------------------------------------------------------------------

/** The 5 steps of 0.2: Analyse -> Herijken -> Opstellen -> Bespreken -> Vaststellen. */
export enum PolicyStatus {
    Analyse = 'analyse',
    Herijken = 'herijken',
    Opstellen = 'opstellen',
    Bespreken = 'bespreken',
    Vastgesteld = 'vastgesteld',
}

/** Construction (`werken`) is governed more strictly than services/supplies; `any` covers rule sets that do not split. */
export enum PurchaseType {
    Werken = 'werken',
    DienstenLeveringen = 'diensten_leveringen',
    Any = 'any',
}

/**
 * `current` is the 2025-2028 tier table; `legacy` is the older three-tier fallback that still
 * governs categories which have not migrated yet. Kept as data rather than dropped, because
 * the real policy runs both during its transition period.
 */
export enum ThresholdRuleSet {
    Current = 'current',
    Legacy = 'legacy',
}

/**
 * Tender procedure. Stored as a stable key, NOT as the Dutch sentence from the source PDF, so
 * the UI can render it through i18n in both locales and other modules can branch on it.
 *
 * The two rule sets keep their own vocabulary rather than being normalised onto one another.
 * `EenOpEen` and `EnkelvoudigOnderhands` do describe the same shape of purchase, but they are
 * the words two different appendices actually use, and a verdict that quotes a term the reader
 * cannot find in their own policy is a verdict they cannot check.
 */
export enum PurchaseProcedure {
    /** Current rule set (§1.1): sole-source. */
    EnkelvoudigOnderhands = 'enkelvoudig_onderhands',
    /** Current rule set (§1.1): invite several parties privately. */
    MeervoudigOnderhands = 'meervoudig_onderhands',
    /** Legacy rule set (Appendix 2): full tender. */
    Aanbesteding = 'aanbesteding',
    /** Legacy rule set (Appendix 2): quote procedure, 2+ parties. */
    Offerteprocedure = 'offerteprocedure',
    /** Legacy rule set (Appendix 2): sole-source. */
    EenOpEen = 'een_op_een',
}

/** Paperwork a tier demands on top of the quote count. Stable key for the same reason as {@link PurchaseProcedure}. */
export enum ExtraRequirement {
    /** Record the request for quotation and the quote(s) received. */
    VastleggenOfferteaanvraag = 'vastleggen_offerteaanvraag',
    /** Award-advice document only. */
    Gunningsadvies = 'gunningsadvies',
    /** Procurement strategy plus an award-advice document. */
    StrategieEnGunningsadvies = 'strategie_en_gunningsadvies',
    /** The full 7-phase category-management cycle. */
    Categoriemanagement = 'categoriemanagement',
}

/** Grounding material for the advisor, mirroring the "Relevante input" list for block 0.2. */
export enum PolicyDocumentKind {
    HuidigInkoopbeleid = 'huidig_inkoopbeleid',
    Visie = 'visie',
    Ondernemersplan = 'ondernemersplan',
    Audit = 'audit',
    MtAmbities = 'mt_ambities',
    Referentie = 'referentie',
}

export enum ReviewDecision {
    Comment = 'comment',
    Approve = 'approve',
    Reject = 'reject',
}

// --- Tables -----------------------------------------------------------------------------

export const organisations = pgTable('organisations', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const policies = pgTable('policies', {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
        .notNull()
        .references(() => organisations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    // `date`, not `timestamp`: a policy is valid for calendar years ("2025-2028"), and a
    // timezone-shifted midnight would silently move a validity boundary by a day.
    periodStart: date('period_start'),
    periodEnd: date('period_end'),
    status: text('status').notNull().default(PolicyStatus.Analyse),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    index('policies_organisation_id_idx').on(table.organisationId),
])

/**
 * The fixed 10-section template every real inkoopbeleid follows. `number` and `key` are both
 * unique per policy: `number` is what a reader cites ("hoofdstuk 6"), `key` is what code
 * addresses so a renumbering never breaks a lookup.
 */
export const policyChapters = pgTable('policy_chapters', {
    id: uuid('id').defaultRandom().primaryKey(),
    policyId: uuid('policy_id')
        .notNull()
        .references(() => policies.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    key: text('key').notNull(),
    title: text('title').notNull(),
    contentMarkdown: text('content_markdown').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    unique('policy_chapters_policy_id_number_key').on(table.policyId, table.number),
    unique('policy_chapters_policy_id_key_key').on(table.policyId, table.key),
    check('policy_chapters_number_range', sql`${table.number} between 1 and 10`),
])

/**
 * Procurement goals. Rows, never a hardcoded enum: the brief is explicit that goals are
 * "editable per organization", and our two demo clients genuinely disagree (Ons Huis has 4,
 * Welbions has 6, with almost no overlap).
 */
export const policyGoals = pgTable('policy_goals', {
    id: uuid('id').defaultRandom().primaryKey(),
    policyId: uuid('policy_id')
        .notNull()
        .references(() => policies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    index('policy_goals_policy_id_idx').on(table.policyId),
])

/**
 * A source document that has been ingested into the vector index.
 *
 * `fileId` is nullable with `set null` on purpose: the searchable text already lives in
 * `rag_vectors`, so deleting the stored blob must not erase the record of what was ingested
 * and how many chunks it produced.
 */
export const policyDocuments = pgTable('policy_documents', {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
        .notNull()
        .references(() => organisations.id, { onDelete: 'cascade' }),
    policyId: uuid('policy_id').references(() => policies.id, { onDelete: 'set null' }),
    fileId: uuid('file_id').references(() => files.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    sourceLabel: text('source_label').notNull().default(''),
    kind: text('kind').notNull().default(PolicyDocumentKind.Referentie),
    chunkCount: integer('chunk_count').notNull().default(0),
    ingestedAt: timestamp('ingested_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    index('policy_documents_organisation_id_idx').on(table.organisationId),
])

/**
 * Which tender procedure a purchase must run. Deliberately NOT merged with {@link mandates}:
 * thresholds decide *how you buy*, mandates decide *who may sign*, and the real policy keeps
 * the two independent during its transition period.
 *
 * Money is `bigint` cents, never a float. `mode: 'number'` is the JS representation only, and
 * is safe here: `Number.MAX_SAFE_INTEGER` is ~9.0e15 cents, i.e. ~90 trillion euro, some ten
 * million times the largest ceiling this domain has (2 million euro).
 */
export const thresholds = pgTable('thresholds', {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
        .notNull()
        .references(() => organisations.id, { onDelete: 'cascade' }),
    ruleSet: text('rule_set').notNull().default(ThresholdRuleSet.Current),
    purchaseType: text('purchase_type').notNull().default(PurchaseType.Any),
    minAmountCents: bigint('min_amount_cents', { mode: 'number' }).notNull().default(0),
    /** `null` = no upper bound (the top tier). Otherwise EXCLUSIVE: a tier covers `[min, max)`. */
    maxAmountCents: bigint('max_amount_cents', { mode: 'number' }),
    procedure: text('procedure').notNull().default(PurchaseProcedure.EnkelvoudigOnderhands),
    minQuotes: integer('min_quotes').notNull().default(1),
    extraRequirement: text('extra_requirement')
        .notNull()
        .default(ExtraRequirement.VastleggenOfferteaanvraag),
    /**
     * Whether an adviseur inkoop must be involved. A column rather than something derived from
     * `extraRequirement`, because involvement and paperwork are separate policy choices: an
     * organisation can demand the advisor at a tier that needs no category management.
     */
    advisorRequired: boolean('advisor_required').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    index('thresholds_organisation_id_idx').on(table.organisationId),
    check(
        'thresholds_amount_range',
        sql`${table.maxAmountCents} is null or ${table.maxAmountCents} > ${table.minAmountCents}`,
    ),
    check('thresholds_min_quotes_positive', sql`${table.minQuotes} >= 1`),
])

/**
 * Signing authority: how much one role may commit on its own. See {@link thresholds} for why
 * this is a separate table.
 *
 * `roleName`, `department` and `scope` are the client's own words, copied from their mandate
 * table, so they are rendered as-is and never translated - unlike `procedure` /
 * `extraRequirement`, which are app vocabulary and do go through i18n.
 */
export const mandates = pgTable('mandates', {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
        .notNull()
        .references(() => organisations.id, { onDelete: 'cascade' }),
    roleName: text('role_name').notNull(),
    department: text('department').notNull().default(''),
    ceilingAmountCents: bigint('ceiling_amount_cents', { mode: 'number' }).notNull().default(0),
    scope: text('scope').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    index('mandates_organisation_id_idx').on(table.organisationId),
    check('mandates_ceiling_non_negative', sql`${table.ceilingAmountCents} >= 0`),
])

/**
 * Stakeholder feedback on a policy or one of its chapters. This is what makes steps 0.2.2
 * (herijken met stakeholders) and 0.2.4 (bespreken concept) real rather than decorative.
 *
 * `userId` survives account deletion as `null` so the audit trail of who-approved-what is not
 * silently rewritten when someone leaves.
 */
export const policyReviews = pgTable('policy_reviews', {
    id: uuid('id').defaultRandom().primaryKey(),
    policyId: uuid('policy_id')
        .notNull()
        .references(() => policies.id, { onDelete: 'cascade' }),
    chapterId: uuid('chapter_id').references(() => policyChapters.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    comment: text('comment').notNull().default(''),
    decision: text('decision').notNull().default(ReviewDecision.Comment),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
    index('policy_reviews_policy_id_idx').on(table.policyId),
])

/**
 * "Pas toe of leg uit" - comply or explain. A recorded, justified departure from the
 * procurement rules.
 *
 * The written justification IS the mechanism, so it is required twice over: `notNull` plus a
 * CHECK that rejects whitespace. A blank explanation would turn comply-or-explain into a
 * rubber stamp, which is the exact failure mode the rule exists to prevent, so the guarantee
 * belongs in the database and not only in a zod schema one careless route could skip.
 */
export const policyDeviations = pgTable('policy_deviations', {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
        .notNull()
        .references(() => organisations.id, { onDelete: 'cascade' }),
    policyId: uuid('policy_id').references(() => policies.id, { onDelete: 'set null' }),
    subject: text('subject').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }),
    purchaseType: text('purchase_type'),
    /** Which rule was not applied, in the client's own words ("2 offertes bij 30.000 euro"). */
    ruleSkipped: text('rule_skipped').notNull(),
    justification: text('justification').notNull(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
        onDelete: 'set null',
    }),
    /** Role that signed off, e.g. "Directeur-bestuurder". Client vocabulary, not translated. */
    approverRole: text('approver_role').notNull().default(''),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id, {
        onDelete: 'set null',
    }),
    approvedAt: timestamp('approved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    index('policy_deviations_organisation_id_idx').on(table.organisationId),
    check(
        'policy_deviations_justification_not_empty',
        sql`length(btrim(${table.justification})) > 0`,
    ),
])

/**
 * Waar de begeleide route (bouwsteen 0.2) het werk van de gebruiker bewaart.
 *
 * Drie tabellen in plaats van een, omdat de route drie soorten invoer kent die zich echt
 * anders gedragen: vrije tekst per onderdeel, aangevinkte checklists, en een variabel aantal
 * gespreksverslagen. Ze in een tabel met een `kind`-kolom persen zou elke rij half leeg maken.
 *
 * `stepKey` en `fieldKey` zijn de stabiele sleutels uit de content
 * (`shared/werkinstructies/bouwsteen-0-2.ts`), niet de titels. De content is bewust geen
 * database-inhoud: de werkinstructie is een document dat door de vakinhoud wordt beheerd, en
 * een titelwijziging daarin mag nooit het werk van een adviseur losbreken van zijn stap.
 */

/** Welke checklist een vinkje hoort bij: de Benodigde input of de Controlevragen. */
export enum StepCheckKind {
    /** Het scherm "Input verzamelen": de Benodigde input van de stap. */
    Input = 'input',
    /** Het scherm "Controleer jezelf": de Controlevragen van de stap. */
    Controle = 'controle',
}

/**
 * Een ingevuld onderdeel van een stapdocument. Een rij per werkscherm dat tekst opleverde.
 *
 * De unieke sleutel is (policy, stap, onderdeel): een onderdeel heeft precies een tekst, dus
 * schrijven is een upsert en niet een insert die duplicaten kan maken.
 */
export const policyStepEntries = pgTable('policy_step_entries', {
    id: uuid('id').defaultRandom().primaryKey(),
    policyId: uuid('policy_id')
        .notNull()
        .references(() => policies.id, { onDelete: 'cascade' }),
    stepKey: text('step_key').notNull(),
    fieldKey: text('field_key').notNull(),
    content: text('content').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    unique('policy_step_entries_policy_step_field_key').on(
        table.policyId,
        table.stepKey,
        table.fieldKey,
    ),
    index('policy_step_entries_policy_id_idx').on(table.policyId),
])

/**
 * Een aangevinkt item uit een van de twee checklists van een stap.
 *
 * `itemIndex` verwijst naar de positie in `benodigdeInput` of `controlevragen` van de stap.
 * Een index en niet de tekst zelf, omdat de tekst uit de werkinstructie komt en daar mag
 * worden bijgeschaafd zonder dat een vinkje verdwijnt. Wordt de volgorde van een checklist
 * ooit omgegooid, dan verschuiven vinkjes mee; dat is bewust geaccepteerd, want de checklist
 * is een hulpmiddel voor de adviseur en geen formeel bewijsstuk.
 */
export const policyStepChecks = pgTable('policy_step_checks', {
    id: uuid('id').defaultRandom().primaryKey(),
    policyId: uuid('policy_id')
        .notNull()
        .references(() => policies.id, { onDelete: 'cascade' }),
    stepKey: text('step_key').notNull(),
    checkKind: text('check_kind').notNull().default(StepCheckKind.Input),
    itemIndex: integer('item_index').notNull(),
    checked: boolean('checked').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    unique('policy_step_checks_policy_step_kind_index_key').on(
        table.policyId,
        table.stepKey,
        table.checkKind,
        table.itemIndex,
    ),
    index('policy_step_checks_policy_id_idx').on(table.policyId),
    check('policy_step_checks_item_index_non_negative', sql`${table.itemIndex} >= 0`),
])

/**
 * Een gespreksverslag binnen een herhaalbaar onderdeel: de stakeholdergesprekken van stap
 * 0.2.2 en 0.2.4.
 *
 * `answers` is jsonb met de sectiesleutels van het richtvragen-sjabloon als sleutels. Jsonb en
 * geen aparte antwoordtabel, omdat het sjabloon content is en geen schema: een sectie erbij in
 * de werkinstructie hoort geen migratie te kosten. Voor de rest van de applicatie is dit ook
 * geen bevraagbare inhoud, in tegenstelling tot drempelbedragen en mandaten, die juist daarom
 * wel echte kolommen hebben.
 */
export const policyStepItems = pgTable('policy_step_items', {
    id: uuid('id').defaultRandom().primaryKey(),
    policyId: uuid('policy_id')
        .notNull()
        .references(() => policies.id, { onDelete: 'cascade' }),
    stepKey: text('step_key').notNull(),
    fieldKey: text('field_key').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    /** Wie er gesproken is, in de woorden van de adviseur. Nooit vertaald. */
    title: text('title').notNull().default(''),
    answers: jsonb('answers').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    index('policy_step_items_policy_id_idx').on(table.policyId),
])

// --- Inferred types ----------------------------------------------------------------------

export type Organisation = typeof organisations.$inferSelect
export type NewOrganisation = typeof organisations.$inferInsert
export type Policy = typeof policies.$inferSelect
export type NewPolicy = typeof policies.$inferInsert
export type PolicyChapter = typeof policyChapters.$inferSelect
export type NewPolicyChapter = typeof policyChapters.$inferInsert
export type PolicyGoal = typeof policyGoals.$inferSelect
export type NewPolicyGoal = typeof policyGoals.$inferInsert
export type PolicyDocument = typeof policyDocuments.$inferSelect
export type NewPolicyDocument = typeof policyDocuments.$inferInsert
export type Threshold = typeof thresholds.$inferSelect
export type NewThreshold = typeof thresholds.$inferInsert
export type Mandate = typeof mandates.$inferSelect
export type NewMandate = typeof mandates.$inferInsert
export type PolicyReview = typeof policyReviews.$inferSelect
export type NewPolicyReview = typeof policyReviews.$inferInsert
export type PolicyDeviation = typeof policyDeviations.$inferSelect
export type NewPolicyDeviation = typeof policyDeviations.$inferInsert
export type PolicyStepEntry = typeof policyStepEntries.$inferSelect
export type NewPolicyStepEntry = typeof policyStepEntries.$inferInsert
export type PolicyStepCheck = typeof policyStepChecks.$inferSelect
export type NewPolicyStepCheck = typeof policyStepChecks.$inferInsert
export type PolicyStepItem = typeof policyStepItems.$inferSelect
export type NewPolicyStepItem = typeof policyStepItems.$inferInsert
