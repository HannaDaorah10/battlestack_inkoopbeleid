import { fetchGatewayModelIds } from '../../../server/mastra/gateways/openai-compat'
import { assertGatewayReady } from './env'

/**
 * List the model ids the gateway actually serves.
 *
 * A sweep that names a model the gateway does not have fails one cell at a time, at the end of a
 * long run, with a message from somebody else's API. Ten seconds here prevents that, and it is the
 * only way to know what sluis.ai is offering you today without opening a browser.
 */
async function main(): Promise<void> {
    assertGatewayReady()

    const ids = await fetchGatewayModelIds()
    if (ids.length === 0) {
        // `fetchGatewayModelIds` swallows its errors and degrades to an empty list, which is right
        // for the app's model picker but useless as a diagnosis here.
        console.log(
            'De gateway gaf geen modellen terug.\n'
            + 'Controleer NUXT_AI_GATEWAY_URL en NUXT_AI_GATEWAY_KEY in my-app/.env, '
            + 'of draai opnieuw met DEBUG_AI_GATEWAY=1 voor de reden.',
        )
        return
    }

    const embedding = ids.filter((id) => /embed|voyage/i.test(id)).sort()
    const chat = ids.filter((id) => !embedding.includes(id)).sort()

    console.log(`Chatmodellen (${chat.length}) - voor "generation.model":`)
    for (const id of chat) console.log(`  ${id}`)

    console.log(`\nEmbeddingmodellen (${embedding.length}) - voor "retrieval.embeddingModel":`)
    for (const id of embedding) console.log(`  ${id}`)

    console.log(
        '\nLet op bij het wisselen van embeddingmodel: een ander model geeft vectoren van een'
        + '\nandere lengte. Voor de harness maakt dat niets uit (elke configuratie krijgt zijn eigen'
        + '\nindex), maar in de app moet NUXT_RAG_EMBEDDING_DIMENSIONS meeveranderen en moet je'
        + '\nopnieuw indexeren.',
    )
}

main().catch((err: unknown) => {
    console.error(`\n${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
})
