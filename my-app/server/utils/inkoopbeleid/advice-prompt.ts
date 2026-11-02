/**
 * The prompt-shaping half of the digitale adviseur: excerpts in, a prompt string out.
 *
 * Split off from `advisor.ts` because everything here is pure. `advisor.ts` reaches the vector
 * index through `utils/rag`, which imports `mastra/utils/ai-model`, which imports the database
 * client — so importing it costs a database connection. The evaluation harness in `tools/eval`
 * must run with no database at all, and it has to build byte-identical prompts to the ones the
 * API route sends, or a sweep tunes something the app never asks.
 *
 * Nitro auto-imports every symbol under `server/utils/`, so these are deliberately NOT re-exported
 * from `advisor.ts`: two modules exporting the same name would collide in the generated imports.
 */

export interface RetrievedSource {
    title: string
    source: string
    score: number
    text: string
}

/**
 * Format excerpts for the model.
 *
 * Each excerpt is labelled with the exact source string the prompt tells the agent to cite, so
 * "cite the source" needs no inference: the literal token to echo is already on the page.
 */
export function formatContextBlock(sources: readonly RetrievedSource[]): string {
    if (sources.length === 0) return ''
    return sources
        .map((s, i) => `--- Fragment ${i + 1} | bron: ${s.source} ---\n${s.text}`)
        .join('\n\n')
}

/** Dutch stand-in used when retrieval comes back empty, so the agent is never asked to answer from nothing. */
export const NO_CONTEXT_NOTICE
    = 'Er zijn geen fragmenten gevonden in de documenten van deze organisatie.'

/**
 * The advisor's user message: retrieved context, then the question.
 *
 * An empty `contextBlock` becomes {@link NO_CONTEXT_NOTICE} rather than short-circuiting the call.
 * The agent is instructed to say plainly that the documents do not cover this, which is a more
 * useful reply than a bare empty-result state, and it keeps "I don't know" a normal answer instead
 * of an error.
 */
export function buildAdvicePrompt(input: { contextBlock: string, question: string }): string {
    return [
        'Context:',
        input.contextBlock || NO_CONTEXT_NOTICE,
        '',
        `Vraag: ${input.question}`,
    ].join('\n')
}

// --- Hoofdstuk schrijven -------------------------------------------------------------------

/** Leesbare namen voor de stabiele sleutels, zodat de AI geen `meervoudig_onderhands` overneemt. */
const PROCEDURE_LABELS: Readonly<Record<string, string>> = {
    enkelvoudig_onderhands: 'Enkelvoudig onderhands',
    meervoudig_onderhands: 'Meervoudig onderhands',
    aanbesteding: 'Aanbesteding',
    offerteprocedure: 'Offerteprocedure',
    een_op_een: 'Eén op één',
}
const PURCHASE_TYPE_LABELS: Readonly<Record<string, string>> = {
    werken: 'Werken',
    diensten_leveringen: 'Diensten en leveringen',
    any: 'Alle soorten',
}
const RULE_SET_LABELS: Readonly<Record<string, string>> = {
    current: 'huidige regelset',
    legacy: 'oude regelset',
}

function euro(cents: number): string {
    return `€ ${(cents / 100).toLocaleString('nl-NL', { maximumFractionDigits: 2 })}`
}

export interface ChapterDraftInput {
    contextBlock: string
    organisationName: string
    policyTitle: string
    chapterNumber: number
    chapterTitle: string
    goals: ReadonlyArray<{ name: string, description: string }>
    thresholds: ReadonlyArray<{
        ruleSet: string
        purchaseType: string
        minAmountCents: number
        maxAmountCents: number | null
        procedure: string
        minQuotes: number
    }>
    mandates: ReadonlyArray<{ roleName: string, department: string, ceilingAmountCents: number }>
    /** Uit `routeAntwoordenVoorHoofdstuk`: wat de adviseur in de begeleide route heeft vastgelegd. */
    routeAntwoorden: string
}

/**
 * De opdracht voor de AI-schrijver bij een hoofdstuk.
 *
 * Twee soorten bronnen, bewust gescheiden: de documentfragmenten (wat er in oude stukken staat)
 * en de gegevens die in de app zijn vastgelegd (organisatienaam, inkoopdoelen, drempels,
 * mandaten en de antwoorden uit de route). Die laatste zijn de actuele keuzes van de organisatie
 * en gaan voor. Eerder kreeg het model alleen de fragmenten en een losse regel met doelnamen,
 * met als gevolg dat hoofdstukken elkaar tegenspraken over de inkoopdoelen, de route-antwoorden
 * nergens terugkwamen en de organisatienaam werd ingekort.
 */
export function buildChapterDraftPrompt(input: ChapterDraftInput): string {
    const goals = input.goals.length > 0
        ? input.goals.map((g) => `- ${g.name}${g.description ? `: ${g.description}` : ''}`).join('\n')
        : 'Er zijn nog geen inkoopdoelen vastgelegd.'

    const thresholds = input.thresholds.length > 0
        ? input.thresholds.map((t) => {
                const range = t.maxAmountCents === null
                    ? `vanaf ${euro(t.minAmountCents)}`
                    : `${euro(t.minAmountCents)} tot ${euro(t.maxAmountCents)}`
                return `- ${PURCHASE_TYPE_LABELS[t.purchaseType] ?? t.purchaseType}, ${range} `
                    + `(${RULE_SET_LABELS[t.ruleSet] ?? t.ruleSet}): `
                    + `${PROCEDURE_LABELS[t.procedure] ?? t.procedure}, minimaal ${t.minQuotes} offerte(s)`
            }).join('\n')
        : 'Er zijn nog geen drempelbedragen vastgelegd.'

    const mandates = input.mandates.length > 0
        ? input.mandates
                .map((m) => `- ${m.roleName}${m.department ? ` (${m.department})` : ''}: tot ${euro(m.ceilingAmountCents)}`)
                .join('\n')
        : 'Er zijn nog geen mandaten vastgelegd.'

    return [
        '## Gegevens van de organisatie (vastgelegd in de app; deze gaan voor op de fragmenten)',
        `Organisatie: ${input.organisationName}`,
        'Gebruik deze naam letterlijk en volledig. Over de sector of het type organisatie is niets '
        + 'opgegeven; noem geen sector en doe er geen aannames over.',
        `Beleidsdocument: ${input.policyTitle}`,
        '',
        'Inkoopdoelen:',
        goals,
        '',
        'Drempelbedragen:',
        thresholds,
        '',
        'Mandaten:',
        mandates,
        '',
        '## Wat de adviseur in de begeleide route heeft vastgelegd',
        input.routeAntwoorden || 'Er is in de route nog niets ingevuld.',
        '',
        '## Fragmenten uit de documenten van de organisatie',
        input.contextBlock || NO_CONTEXT_NOTICE,
        '',
        `Schrijf de tekst van hoofdstuk ${input.chapterNumber} (${input.chapterTitle}). `
        + 'Neem de vastgelegde gegevens en de route-antwoorden over waar ze bij dit hoofdstuk '
        + 'horen, en spreek ze niet tegen.',
    ].join('\n')
}
