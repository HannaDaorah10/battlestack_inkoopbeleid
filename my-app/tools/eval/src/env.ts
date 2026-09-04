import { resolve } from 'node:path'
import { config } from 'dotenv'
import { gatewayConfigError } from '../../../server/mastra/gateways/openai-compat'
import { APP_ROOT } from './paths'

/**
 * The harness runs outside Nitro, so `useRuntimeConfig()` does not exist here and `.env` is not
 * loaded for us. The gateway module reads `process.env` directly (it has to, for Mastra Studio),
 * which is what lets the same code serve both.
 *
 * `gatewayEndpoints()` memoises on its first call, so `.env` must be in place before anything
 * touches the gateway. Every entry point calls `loadEnv()` first.
 */

let loaded = false

export function loadEnv(): void {
    if (loaded) return
    // dotenv does not overwrite variables already set, so a value exported in the shell still wins
    // - handy for pointing one run at a different gateway without editing the file.
    config({ path: resolve(APP_ROOT, '.env'), quiet: true })
    loaded = true
}

export function assertGatewayReady(): void {
    loadEnv()
    const problem = gatewayConfigError()
    if (!problem) return

    throw new Error(
        `De AI-gateway is niet geconfigureerd: ${problem.message}.\n`
        + `Zet NUXT_AI_GATEWAY_URL en NUXT_AI_GATEWAY_KEY in ${resolve(APP_ROOT, '.env')}. `
        + 'Zie AI-SETUP.md, stap 2 en 3.',
    )
}
