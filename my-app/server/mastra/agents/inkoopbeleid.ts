import { Agent } from '@mastra/core/agent'
// Relative imports so `mastra dev` (standalone bundler) can resolve these too;
// `#server/*` is a Nuxt/Nitro alias that doesn't exist inside Mastra's bundle.
import { getAgentModelId, getAgentInstructions } from '../utils/agent-runtime'

/**
 * The digitale adviseur: answers procurement questions strictly from the excerpts the caller
 * retrieves for it. Its instructions and model both resolve per call from the `agents` row, so
 * an admin can retune the prompt at `/dashboard/prompts` with no redeploy.
 */
export const inkoopbeleidAgent = new Agent({
    id: 'inkoopbeleid',
    name: 'inkoopbeleid',
    instructions: () => getAgentInstructions('inkoopbeleid'),
    model: () => getAgentModelId('inkoopbeleid'),
})

/**
 * The drafting counterpart. A separate agent rather than a second prompt threaded through the
 * advisor, because the two jobs want genuinely different instructions - one answers a question
 * as briefly as the sources allow, the other produces a long structured chapter - and keeping
 * them apart means an admin can retune either without disturbing the other.
 */
export const inkoopbeleidRedacteurAgent = new Agent({
    id: 'inkoopbeleid-redacteur',
    name: 'inkoopbeleid-redacteur',
    instructions: () => getAgentInstructions('inkoopbeleid-redacteur'),
    model: () => getAgentModelId('inkoopbeleid-redacteur'),
})
