import { eq } from 'drizzle-orm'
import { db } from '#server/database/client'
import { organisations, type Organisation } from '#server/database/schema/inkoopbeleid'

/**
 * Resolve an organisation id, or 404.
 *
 * Every inkoopbeleid route takes `organisationId` from the caller, so this is the one place
 * that turns an arbitrary uuid into a row that is known to exist. Without it a bad id would
 * silently produce empty lists and empty advisor answers, which reads as "this organisation
 * has no policy" rather than "that organisation does not exist".
 *
 * Note what this is NOT: it is not an authorisation check. Every signed-in user of this
 * proof of concept may read every organisation, because there is no user-to-organisation
 * membership model yet. When one arrives, it belongs here, and every caller inherits it.
 */
export async function requireOrganisation(organisationId: string): Promise<Organisation> {
    const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, organisationId))
        .limit(1)

    if (!org) {
        throw createError({ statusCode: 404, statusMessage: 'Organisation not found' })
    }
    return org
}
