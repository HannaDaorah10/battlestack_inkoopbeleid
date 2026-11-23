import type { H3Event } from 'h3'
import { db } from '#server/database/client'
import type { Role } from '#server/database/schema/users'
import { sessions } from '#server/database/schema/sessions'

export interface SessionUser {
    id: string
    email: string
    name?: string
    role?: Role
    theme?: string
    locale?: string
}

export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

/** Create a server-side session row and return its id. */
export async function createDbSession(userId: string, event: H3Event): Promise<string> {
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS)
    const userAgent = getRequestHeader(event, 'user-agent') ?? null
    const ip = getRequestIP(event, { xForwardedFor: true }) ?? null
    const [row] = await db
        .insert(sessions)
        .values({ userId, expiresAt, userAgent, ip })
        .returning({ id: sessions.id })
    if (!row) {
        throw createError({ statusCode: 500, statusMessage: 'Failed to create session' })
    }
    return row.id
}

/** Require an authenticated user with one of the given roles. Throws 401/403. */
export async function requireRole(event: H3Event, ...roles: Role[]) {
    const session = await requireUserSession(event)
    if (!session.user.role || !roles.includes(session.user.role as Role)) {
        throw createError({
            statusCode: 403,
            statusMessage: 'Insufficient permissions',
        })
    }
    return session
}

/** Read a required router param, throwing 400 when missing. */
export function requireRouterParam(event: H3Event, name: string): string {
    const value = getRouterParam(event, name)
    if (!value) {
        throw createError({ statusCode: 400, statusMessage: `Missing ${name}` })
    }
    return value
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Read a router param that addresses a `uuid` column, rejecting anything that is not one.
 *
 * Without the shape check the raw string reaches `eq(table.id, value)`, and Postgres answers a
 * malformed uuid with `invalid input syntax for type uuid` — which escapes as a **500**. A
 * client asking for a row that cannot exist deserves a 400, not an error that looks like the
 * server broke, and a route that 500s on garbage input is noise in every alert channel.
 */
export function requireUuidRouterParam(event: H3Event, name: string): string {
    const value = requireRouterParam(event, name)
    if (!UUID_RE.test(value)) {
        throw createError({ statusCode: 400, statusMessage: `Invalid ${name}` })
    }
    return value
}
