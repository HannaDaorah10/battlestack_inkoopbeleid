import { createHash } from 'node:crypto'
import type { GenerationConfig, GenerationGrid, RetrievalConfig, RetrievalGrid } from './types'

/**
 * Turn a grid of value lists into the list of configurations to run - the equivalent of a batch
 * scheduler expanding an array job.
 *
 * Keys are visited in sorted order so the output order is stable across runs and machines, which
 * is what makes `--limit` and resume behave predictably.
 */
export function expandGrid<T extends Record<string, readonly unknown[]>>(
    grid: T,
): Array<{ [K in keyof T]: T[K][number] }> {
    const keys = Object.keys(grid).sort() as Array<keyof T & string>
    let rows: Array<Record<string, unknown>> = [{}]

    for (const key of keys) {
        const values = grid[key]
        if (!values || values.length === 0) {
            throw new Error(`Grid key "${key}" has no values; give it at least one.`)
        }
        const next: Array<Record<string, unknown>> = []
        for (const row of rows) {
            for (const value of values) next.push({ ...row, [key]: value })
        }
        rows = next
    }

    return rows as Array<{ [K in keyof T]: T[K][number] }>
}

/**
 * A short, stable id for one configuration.
 *
 * Stable means the same settings always hash the same, regardless of the order the keys happened
 * to be written in. That property is load-bearing: resume skips a cell by matching this id, so an
 * id that drifted between runs would silently redo (and re-pay for) work already done.
 */
export function configId(prefix: string, config: Record<string, unknown>): string {
    const canonical = JSON.stringify(
        Object.keys(config).sort().map((k) => [k, config[k]]),
    )
    return `${prefix}_${createHash('sha1').update(canonical).digest('hex').slice(0, 8)}`
}

export function expandRetrieval(grid: RetrievalGrid): RetrievalConfig[] {
    return expandGrid(grid).map((row) => ({ configId: configId('r', row), ...row }))
}

export function expandGeneration(grid: GenerationGrid): GenerationConfig[] {
    // `samples` is how many times to draw a cell, not a dimension of the grid: including it would
    // produce N distinct configurations that are in fact the same settings.
    const { samples: _samples, ...knobs } = grid
    return expandGrid(knobs).map((row) => ({ configId: configId('g', row), ...row }))
}

/**
 * Group retrieval configurations by the work that produces their vectors.
 *
 * `topK` is applied when querying, so configurations that differ only in `topK` share one embedded
 * index. Building per group instead of per configuration is the difference between embedding the
 * corpus 24 times and embedding it 12 times, at identical results.
 */
export function groupByIndex(configs: readonly RetrievalConfig[]): Map<string, RetrievalConfig[]> {
    const groups = new Map<string, RetrievalConfig[]>()
    for (const config of configs) {
        const key = indexKey(config)
        const bucket = groups.get(key) ?? []
        bucket.push(config)
        groups.set(key, bucket)
    }
    return groups
}

export function indexKey(config: {
    embeddingModel: string
    maxChunkSize: number
    chunkOverlap: number
}): string {
    return configId('idx', {
        embeddingModel: config.embeddingModel,
        maxChunkSize: config.maxChunkSize,
        chunkOverlap: config.chunkOverlap,
    })
}
