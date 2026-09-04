import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/**
 * Every path in the harness is resolved from this module's own location, never from
 * `process.cwd()`. A sweep is started from the project root by a pnpm script, but also directly
 * with `tsx` from wherever someone happens to be standing; anchoring on the module keeps both
 * working and keeps run output out of random directories.
 */
export const EVAL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** The Nuxt project root (`my-app`), two levels above `tools/eval`. */
export const APP_ROOT = resolve(EVAL_ROOT, '..', '..')

export function evalPath(...segments: string[]): string {
    return resolve(EVAL_ROOT, ...segments)
}

export function runPath(sweepName: string, ...segments: string[]): string {
    return resolve(EVAL_ROOT, 'runs', sweepName, ...segments)
}
