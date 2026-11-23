/**
 * Concurrency and retries for gateway calls.
 *
 * A sweep is thousands of independent requests against a shared, rate-limited upstream. Running
 * them one at a time wastes hours; running them all at once earns a wall of 429s. A fixed pool
 * with backoff is the middle, and it keeps the failure of one cell local: a cell that keeps
 * failing is recorded as an error and the rest of the run continues.
 */

export async function runPool<T, R>(
    items: readonly T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results: R[] = new Array<R>(items.length)
    let next = 0

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        for (;;) {
            const index = next++
            if (index >= items.length) return
            results[index] = await worker(items[index]!, index)
        }
    })

    await Promise.all(workers)
    return results
}

export interface RetryOptions {
    attempts?: number
    baseDelayMs?: number
    onRetry?: (attempt: number, error: unknown, delayMs: number) => void
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
    const attempts = opts.attempts ?? 4
    const baseDelayMs = opts.baseDelayMs ?? 1000
    let lastError: unknown

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await fn()
        } catch (err) {
            lastError = err
            // A 400 is a broken request: the same call will break the same way every time, so
            // retrying only burns quota and delays the error the operator needs to see.
            if (attempt === attempts || !isRetryable(err)) throw err

            // Exponential backoff with jitter. Without jitter, every worker that hit the same
            // rate limit wakes at the same instant and trips it again in lockstep.
            const delay = baseDelayMs * 2 ** (attempt - 1) * (0.5 + Math.random())
            opts.onRetry?.(attempt, err, delay)
            await sleep(delay)
        }
    }

    throw lastError
}

/** Rate limits, upstream hiccups and dropped sockets are worth another try; nothing else is. */
export function isRetryable(err: unknown): boolean {
    const status = statusOf(err)
    if (status !== null) return status === 408 || status === 409 || status === 429 || status >= 500

    const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
    return (
        message.includes('econnreset')
        || message.includes('etimedout')
        || message.includes('econnrefused')
        || message.includes('socket hang up')
        || message.includes('network')
        || message.includes('fetch failed')
        || message.includes('rate limit')
    )
}

function statusOf(err: unknown): number | null {
    if (!err || typeof err !== 'object') return null
    const candidate = err as { statusCode?: unknown, status?: unknown, response?: { status?: unknown } }
    for (const value of [candidate.statusCode, candidate.status, candidate.response?.status]) {
        if (typeof value === 'number' && Number.isFinite(value)) return value
    }
    return null
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
