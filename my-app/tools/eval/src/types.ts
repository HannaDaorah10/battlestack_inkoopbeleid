import { z } from 'zod'

/**
 * Schemas for everything a sweep reads off disk. Validated rather than trusted: a typo in
 * `sweep.json` should stop the run with one readable line, not surface an hour later as a
 * confusing gateway error halfway through a batch you are paying for.
 */

export const caseSchema = z.object({
    id: z.string().min(1),
    vraag: z.string().min(3),
    /** Slug that keeps organisations apart, mirroring the app's `organisationId` filter. */
    organisatie: z.string().min(1).default('onbekend'),
    /**
     * Words or amounts that must appear in a retrieved fragment for retrieval to count as a hit.
     * Only phase 1 uses this; phase 2 is judged by people.
     */
    verwachteTrefwoorden: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
})

export type EvalCase = z.infer<typeof caseSchema>

const nonEmptyNumbers = z.array(z.number()).min(1)
const nonEmptyStrings = z.array(z.string().min(1)).min(1)

export const retrievalGridSchema = z.object({
    embeddingModel: nonEmptyStrings,
    maxChunkSize: z.array(z.number().int().positive()).min(1),
    chunkOverlap: z.array(z.number().int().nonnegative()).min(1),
    topK: z.array(z.number().int().positive()).min(1),
})

export const generationGridSchema = z.object({
    model: nonEmptyStrings,
    temperature: nonEmptyNumbers,
    topP: nonEmptyNumbers.default([1]),
    maxOutputTokens: z.array(z.number().int().positive()).min(1).default([1200]),
    /** Paths, relative to tools/eval, of Markdown files holding one system prompt each. */
    systemPrompt: nonEmptyStrings,
    /** Repeated draws of the same configuration; the AI SDK dropped OpenAI's `n` parameter. */
    samples: z.number().int().positive().default(1),
})

/**
 * A source document. The object form exists for the organisation slug: the app keeps tenants apart
 * with an `organisationId` metadata filter (see `server/utils/inkoopbeleid/advisor.ts`), so a sweep
 * that searched both policies at once would measure a pipeline the app never runs - and would
 * flatter itself, because the right answer is reachable from the wrong organisation's document.
 */
export const corpusEntrySchema = z.union([
    z.string().min(1),
    z.object({
        path: z.string().min(1),
        organisatie: z.string().min(1).default('onbekend'),
        titel: z.string().min(1).optional(),
    }),
])

export type CorpusEntry = z.infer<typeof corpusEntrySchema>

export const sweepSchema = z.object({
    name: z.string().min(1),
    corpus: z.array(corpusEntrySchema).min(1),
    questions: z.string().min(1).default('cases/vragen.jsonl'),
    retrieval: retrievalGridSchema,
    generation: generationGridSchema.optional(),
    concurrency: z.number().int().positive().max(32).default(4),
    /** Hard ceiling on gateway calls. The runner stops and says so rather than quietly spending. */
    maxCalls: z.number().int().positive().default(2000),
})

export type Sweep = z.infer<typeof sweepSchema>
export type RetrievalGrid = z.infer<typeof retrievalGridSchema>
export type GenerationGrid = z.infer<typeof generationGridSchema>

/** One expanded cell of the retrieval grid. */
export interface RetrievalConfig {
    configId: string
    embeddingModel: string
    maxChunkSize: number
    chunkOverlap: number
    topK: number
}

/** One expanded cell of the generation grid. */
export interface GenerationConfig {
    configId: string
    model: string
    temperature: number
    topP: number
    maxOutputTokens: number
    systemPrompt: string
}

export interface RetrievalFragment {
    rank: number
    score: number
    source: string
    text: string
}

export interface RetrievalRun {
    configId: string
    caseId: string
    /**
     * False when the question carries no expected keywords. Such a question still shows its
     * fragments in the report, but is left out of recall and MRR: counting it as a miss would
     * penalise every configuration equally and drag the numbers away from the real differences.
     */
    scoreable: boolean
    hit: boolean
    /** 1-based rank of the first fragment containing every expected keyword; 0 when none did. */
    firstHitRank: number
    reciprocalRank: number
    topScore: number
    fragments: RetrievalFragment[]
    durationMs: number
}

export interface GenerationRun {
    configId: string
    caseId: string
    sampleIndex: number
    answer: string
    error: string | null
    finishReason: string | null
    promptTokens: number | null
    completionTokens: number | null
    durationMs: number
    grounded: boolean
    sources: string[]
    /** Machine-checkable warnings; see `checks.ts` for what each one means. */
    flags: string[]
}
