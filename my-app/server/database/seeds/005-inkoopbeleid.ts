import { eq } from 'drizzle-orm'
import {
    ExtraRequirement,
    PolicyStatus,
    PurchaseProcedure,
    PurchaseType,
    ThresholdRuleSet,
    mandates,
    organisations,
    policies,
    policyChapters,
    policyGoals,
    thresholds,
} from '../schema/inkoopbeleid'
import { POLICY_CHAPTER_TEMPLATE } from '../../utils/inkoopbeleid/chapters'
import type { db as Db } from '../client'

/**
 * Seed two demo woningcorporaties.
 *
 * Ons Huis is the fully populated one: its published 2025-2028 policy is the source for every
 * threshold and mandate below. Welbions exists to prove the multi-organisation claim is real
 * rather than decorative - it gets its own, genuinely different goals, and deliberately gets
 * NO thresholds or mandates, because we do not have its numbers and inventing them would put
 * fiction in a table other modules are meant to trust.
 *
 * Idempotent by organisation slug, matching the other seeds: an organisation that already
 * exists is left exactly as it is, so a reseed never clobbers edits made in the UI.
 */

/** Cents per euro. Amounts below read as `<euros> * EUR`, so 30.000 euro is 3_000_000 cents. */
const EUR = 100

interface SeedThreshold {
    ruleSet: ThresholdRuleSet
    purchaseType: PurchaseType
    minAmountCents: number
    maxAmountCents: number | null
    procedure: PurchaseProcedure
    minQuotes: number
    extraRequirement: ExtraRequirement
    advisorRequired: boolean
}

/**
 * Ons Huis 2025-2028, chapter 6. All amounts include VAT and cover the WHOLE contract, not one
 * year; a recurring annual contract is valued at 4x its yearly amount before a tier is picked
 * (see `selectProcedure` in `server/utils/inkoopbeleid/thresholds.ts`).
 *
 * `advisorRequired` is true exactly on the top tier of each purchase type, because the policy
 * makes the adviseur inkoop mandatory "above the category-management thresholds" - which is
 * that tier and no other.
 */
const ONS_HUIS_THRESHOLDS: SeedThreshold[] = [
    // --- Werken (construction): always at least 3 quotes ---
    {
        ruleSet: ThresholdRuleSet.Current,
        purchaseType: PurchaseType.Werken,
        minAmountCents: 2_000_000 * EUR,
        maxAmountCents: null,
        procedure: PurchaseProcedure.MeervoudigOnderhands,
        minQuotes: 3,
        extraRequirement: ExtraRequirement.Categoriemanagement,
        advisorRequired: true,
    },
    {
        ruleSet: ThresholdRuleSet.Current,
        purchaseType: PurchaseType.Werken,
        minAmountCents: 500_000 * EUR,
        maxAmountCents: 2_000_000 * EUR,
        procedure: PurchaseProcedure.MeervoudigOnderhands,
        minQuotes: 3,
        extraRequirement: ExtraRequirement.StrategieEnGunningsadvies,
        advisorRequired: false,
    },
    {
        ruleSet: ThresholdRuleSet.Current,
        purchaseType: PurchaseType.Werken,
        minAmountCents: 100_000 * EUR,
        // The source PDF prints this row's upper bound as "> 500.000 euro", which cannot be
        // right: it would overlap the tier above and leave 100.000-500.000 uncovered. Encoded
        // as "< 500.000" (exclusive), the reading that makes the four tiers partition the range
        // without a gap or an overlap. Confirm with the client before this leaves the PoC.
        maxAmountCents: 500_000 * EUR,
        procedure: PurchaseProcedure.MeervoudigOnderhands,
        minQuotes: 3,
        extraRequirement: ExtraRequirement.Gunningsadvies,
        advisorRequired: false,
    },
    {
        ruleSet: ThresholdRuleSet.Current,
        purchaseType: PurchaseType.Werken,
        minAmountCents: 0,
        maxAmountCents: 100_000 * EUR,
        procedure: PurchaseProcedure.EnkelvoudigOnderhands,
        minQuotes: 1,
        extraRequirement: ExtraRequirement.VastleggenOfferteaanvraag,
        advisorRequired: false,
    },

    // --- Diensten en leveringen (services and supplies): drops to 2 quotes at lower tiers ---
    {
        ruleSet: ThresholdRuleSet.Current,
        purchaseType: PurchaseType.DienstenLeveringen,
        minAmountCents: 250_000 * EUR,
        maxAmountCents: null,
        procedure: PurchaseProcedure.MeervoudigOnderhands,
        minQuotes: 3,
        extraRequirement: ExtraRequirement.Categoriemanagement,
        advisorRequired: true,
    },
    {
        ruleSet: ThresholdRuleSet.Current,
        purchaseType: PurchaseType.DienstenLeveringen,
        minAmountCents: 50_000 * EUR,
        maxAmountCents: 250_000 * EUR,
        procedure: PurchaseProcedure.MeervoudigOnderhands,
        minQuotes: 2,
        extraRequirement: ExtraRequirement.StrategieEnGunningsadvies,
        advisorRequired: false,
    },
    {
        ruleSet: ThresholdRuleSet.Current,
        purchaseType: PurchaseType.DienstenLeveringen,
        minAmountCents: 25_000 * EUR,
        maxAmountCents: 50_000 * EUR,
        procedure: PurchaseProcedure.MeervoudigOnderhands,
        minQuotes: 2,
        extraRequirement: ExtraRequirement.VastleggenOfferteaanvraag,
        advisorRequired: false,
    },
    {
        ruleSet: ThresholdRuleSet.Current,
        purchaseType: PurchaseType.DienstenLeveringen,
        minAmountCents: 0,
        maxAmountCents: 25_000 * EUR,
        procedure: PurchaseProcedure.EnkelvoudigOnderhands,
        minQuotes: 1,
        extraRequirement: ExtraRequirement.VastleggenOfferteaanvraag,
        advisorRequired: false,
    },

    // --- Legacy (Appendix 2): a simpler 3-tier set with no werken/diensten split. ---
    // Still live for categories that have not migrated to the tiers above, which is why it is
    // seeded as data rather than dropped as history.
    {
        ruleSet: ThresholdRuleSet.Legacy,
        purchaseType: PurchaseType.Any,
        minAmountCents: 100_000 * EUR,
        maxAmountCents: null,
        procedure: PurchaseProcedure.Aanbesteding,
        minQuotes: 3,
        extraRequirement: ExtraRequirement.Gunningsadvies,
        advisorRequired: false,
    },
    {
        ruleSet: ThresholdRuleSet.Legacy,
        purchaseType: PurchaseType.Any,
        minAmountCents: 15_000 * EUR,
        maxAmountCents: 100_000 * EUR,
        procedure: PurchaseProcedure.Offerteprocedure,
        minQuotes: 2,
        extraRequirement: ExtraRequirement.VastleggenOfferteaanvraag,
        advisorRequired: false,
    },
    {
        ruleSet: ThresholdRuleSet.Legacy,
        purchaseType: PurchaseType.Any,
        minAmountCents: 0,
        maxAmountCents: 15_000 * EUR,
        procedure: PurchaseProcedure.EenOpEen,
        minQuotes: 1,
        extraRequirement: ExtraRequirement.VastleggenOfferteaanvraag,
        advisorRequired: false,
    },
]

/**
 * Ons Huis signing ceilings, Appendix 2 (dated 15 Dec 2021), all incl. VAT.
 *
 * Taken from the full appendix rather than the abbreviated list in `CODING-PLAN.md` section 4:
 * the appendix is a strict superset (it carries the scope column this table has, keeps the two
 * roles the short list collapses, and includes "Projectleider installaties en onderhoud", which
 * the short list drops entirely). Scopes are given in Dutch, matching the rest of the client's
 * own vocabulary in this table.
 *
 * NOT merged with the thresholds above: these decide who may sign, those decide how you buy.
 */
const ONS_HUIS_MANDATES = [
    { roleName: 'Directeur-bestuurder', department: '', ceiling: 1_000_000 * EUR, scope: 'alles' },
    { roleName: 'Manager vastgoed', department: 'Vastgoed', ceiling: 100_000 * EUR, scope: 'vastgoed' },
    { roleName: 'Projectleider vastgoedontwikkeling/vastgoed', department: 'Vastgoed', ceiling: 50_000 * EUR, scope: 'vastgoed' },
    { roleName: 'Projectleider installaties en onderhoud / Technisch medewerker vastgoed', department: 'Vastgoed', ceiling: 15_000 * EUR, scope: 'onderhoudscontracten' },
    { roleName: 'Manager bedrijfsbeheer', department: 'Bedrijfsbeheer', ceiling: 50_000 * EUR, scope: 'algemeen' },
    { roleName: 'Coördinator ICT', department: 'Bedrijfsbeheer', ceiling: 15_000 * EUR, scope: 'ICT' },
    { roleName: 'Secretaresse / Directie-assistent', department: 'Bedrijfsbeheer/Staf', ceiling: 2_500 * EUR, scope: 'facilitair' },
    { roleName: 'Manager wonen', department: 'Wonen', ceiling: 50_000 * EUR, scope: 'huurders, algemeen' },
    { roleName: 'Teamleider wonen / Technisch consulent', department: 'Wonen', ceiling: 15_000 * EUR, scope: 'onderhoud, woningverbetering' },
    { roleName: 'Verhuur- en verkoopmakelaar', department: 'Wonen', ceiling: 10_000 * EUR, scope: 'huurdersservicecontracten, makelaardij' },
    { roleName: 'Coördinator/Medewerker KCC', department: 'Wonen', ceiling: 5_000 * EUR, scope: 'dagelijks onderhoud' },
    { roleName: 'Wijkbeheerder', department: 'Wonen', ceiling: 1_000 * EUR, scope: 'huurdersservicecontracten' },
    { roleName: 'Overige rollen (m.u.v. financiële administratie)', department: '', ceiling: 250 * EUR, scope: 'algemeen' },
]

interface SeedGoal {
    name: string
    description: string
}

/** Ons Huis names 4 goals. */
const ONS_HUIS_GOALS: SeedGoal[] = [
    { name: 'Verduurzaming', description: 'Inkoop draagt bij aan de verduurzaming van het woningbezit.' },
    { name: 'Betaalbaarheid', description: 'Scherp inkopen houdt het wonen betaalbaar voor huurders.' },
    { name: 'Kwaliteit', description: 'Leveranciers leveren aantoonbare kwaliteit, ook na oplevering.' },
    { name: 'Sociale impact', description: 'Opdrachten leveren waarde op voor de wijk en haar bewoners.' },
]

/**
 * Welbions names 6, with different wording and only "Kwaliteit" in common. This disagreement
 * is the point: it is why goals are rows and not a hardcoded enum.
 */
const WELBIONS_GOALS: SeedGoal[] = [
    { name: 'Duurzaamheid', description: 'Inkoop ondersteunt de duurzaamheidsambities van de corporatie.' },
    { name: 'Kosten', description: 'Grip op de totale kosten over de hele looptijd van een contract.' },
    { name: 'Kwaliteit', description: 'Afspraken over kwaliteit zijn meetbaar en worden gehandhaafd.' },
    { name: 'Maatschappelijk betrokken', description: 'Opdrachten dragen bij aan maatschappelijke doelen.' },
    { name: 'Proces', description: 'Het inkoopproces is uniform, navolgbaar en efficiënt.' },
    { name: 'Samenwerken', description: 'Langdurige samenwerking met leveranciers boven eenmalige scherpe deals.' },
]

export default async function seed(db: typeof Db): Promise<void> {
    await seedOnsHuis(db)
    await seedWelbions(db)
}

async function seedOnsHuis(db: typeof Db): Promise<void> {
    const slug = 'ons-huis'
    if (await organisationExists(db, slug)) {
        console.log(`  organisation already present, skipped: ${slug}`)
        return
    }

    const [org] = await db
        .insert(organisations)
        .values({ name: 'Woningstichting Ons Huis', slug })
        .returning({ id: organisations.id })
    if (!org) throw new Error('failed to insert organisation ons-huis')
    console.log(`  organisation seeded: ${slug}`)

    const [policy] = await db
        .insert(policies)
        .values({
            organisationId: org.id,
            title: 'Inkoopbeleid 2025-2028',
            periodStart: '2025-01-01',
            periodEnd: '2028-12-31',
            // Mid-workflow on purpose: the demo starts from a policy being written, so the
            // status transitions in `/dashboard/inkoopbeleid/[id]` have somewhere to go.
            status: PolicyStatus.Opstellen,
        })
        .returning({ id: policies.id })
    if (!policy) throw new Error('failed to insert policy for ons-huis')

    await seedChapters(db, policy.id)
    await seedGoals(db, policy.id, ONS_HUIS_GOALS)

    await db.insert(thresholds).values(
        ONS_HUIS_THRESHOLDS.map((t) => ({ ...t, organisationId: org.id })),
    )
    console.log(`  thresholds seeded: ${ONS_HUIS_THRESHOLDS.length}`)

    await db.insert(mandates).values(
        ONS_HUIS_MANDATES.map((m) => ({
            organisationId: org.id,
            roleName: m.roleName,
            department: m.department,
            ceilingAmountCents: m.ceiling,
            scope: m.scope,
        })),
    )
    console.log(`  mandates seeded: ${ONS_HUIS_MANDATES.length}`)
}

async function seedWelbions(db: typeof Db): Promise<void> {
    const slug = 'welbions'
    if (await organisationExists(db, slug)) {
        console.log(`  organisation already present, skipped: ${slug}`)
        return
    }

    const [org] = await db
        .insert(organisations)
        .values({ name: 'Welbions', slug })
        .returning({ id: organisations.id })
    if (!org) throw new Error('failed to insert organisation welbions')
    console.log(`  organisation seeded: ${slug}`)

    const [policy] = await db
        .insert(policies)
        .values({
            organisationId: org.id,
            title: 'Inkoopbeleid',
            // Left at the first step: this organisation has goals but no numbers yet, which is
            // exactly what "analyse bestaand beleid en kaders" describes.
            status: PolicyStatus.Analyse,
        })
        .returning({ id: policies.id })
    if (!policy) throw new Error('failed to insert policy for welbions')

    await seedChapters(db, policy.id)
    await seedGoals(db, policy.id, WELBIONS_GOALS)

    // No thresholds and no mandates on purpose: see the file header.
    console.log('  welbions: no thresholds/mandates seeded (numbers not available)')
}

async function organisationExists(db: typeof Db, slug: string): Promise<boolean> {
    const [existing] = await db
        .select({ id: organisations.id })
        .from(organisations)
        .where(eq(organisations.slug, slug))
        .limit(1)
    return !!existing
}

async function seedChapters(db: typeof Db, policyId: string): Promise<void> {
    await db.insert(policyChapters).values(
        POLICY_CHAPTER_TEMPLATE.map((c) => ({
            policyId,
            number: c.number,
            key: c.key,
            title: c.title,
        })),
    )
}

async function seedGoals(db: typeof Db, policyId: string, goals: SeedGoal[]): Promise<void> {
    await db.insert(policyGoals).values(
        goals.map((g, i) => ({
            policyId,
            name: g.name,
            description: g.description,
            sortOrder: i,
        })),
    )
}
