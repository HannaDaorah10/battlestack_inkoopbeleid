import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveRetrieval } from '../../tools/eval/src/resolve-retrieval'
import type { RetrievalConfig } from '../../tools/eval/src/types'

const cleanup: string[] = []

afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

function config(configId: string): RetrievalConfig {
    return {
        configId,
        embeddingModel: 'bedrock/eu.cohere.embed-v4:0',
        maxChunkSize: 500,
        chunkOverlap: 100,
        topK: 5,
    }
}

/**
 * `runPath` resolves an absolute `sweepName` as-is (Node's `path.resolve` restarts from the last
 * absolute segment), so a temp directory stands in for `runs/<sweep>` without touching real state.
 */
async function withRanglijst(
    configs: RetrievalConfig[],
    rows: Array<{ configId: string }>,
): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'eval-resolve-'))
    cleanup.push(dir)
    await mkdir(join(dir, 'retrieval'), { recursive: true })
    await writeFile(join(dir, 'retrieval', 'ranglijst.json'), JSON.stringify({ configs, rows }), 'utf8')
    return dir
}

describe('resolveRetrieval', () => {
    it('picks the phase-1 winner when nothing is requested', { timeout: 120_000 }, async () => {
        const sweepDir = await withRanglijst(
            [config('r_a'), config('r_b')],
            [{ configId: 'r_b' }, { configId: 'r_a' }],
        )
        const found = await resolveRetrieval(sweepDir, null)
        expect(found.configId).toBe('r_b')
    })

    it('picks a specifically requested configuration instead of the winner', { timeout: 120_000 }, async () => {
        const sweepDir = await withRanglijst(
            [config('r_a'), config('r_b')],
            [{ configId: 'r_a' }, { configId: 'r_b' }],
        )
        const found = await resolveRetrieval(sweepDir, 'r_b')
        expect(found.configId).toBe('r_b')
    })

    it('rejects a requested configuration absent from the ranking, listing what is available', { timeout: 120_000 }, async () => {
        const sweepDir = await withRanglijst([config('r_a')], [{ configId: 'r_a' }])
        await expect(resolveRetrieval(sweepDir, 'r_missing')).rejects.toThrow(/r_a/)
    })

    it('tells the caller to run phase 1 first when there are no results at all', { timeout: 120_000 }, async () => {
        const dir = await mkdtemp(join(tmpdir(), 'eval-resolve-'))
        cleanup.push(dir)
        await expect(resolveRetrieval(dir, null)).rejects.toThrow(/eval:retrieval/)
    })
})
