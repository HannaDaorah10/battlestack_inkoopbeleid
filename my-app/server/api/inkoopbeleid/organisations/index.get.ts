import { asc } from 'drizzle-orm'
import { db } from '#server/database/client'
import { organisations } from '#server/database/schema/inkoopbeleid'

/** Every organisation, for the organisation switcher. */
export default defineEventHandler(async (event) => {
    await requireUserSession(event)

    return db
        .select({
            id: organisations.id,
            name: organisations.name,
            slug: organisations.slug,
        })
        .from(organisations)
        .orderBy(asc(organisations.name))
})
