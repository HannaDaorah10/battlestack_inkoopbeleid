import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { apiPost, BASE_URL, isServerUp, loginAsAdmin } from '~~/test/helpers/setup'

const serverUp = await isServerUp()

interface OrganisationRow {
    id: string
    name: string
    slug: string
}

describe('e2e: self-service organisations', () => {
    it.skipIf(!serverUp)('creates a new organisation by name', async () => {
        const cookie = await loginAsAdmin()
        const name = `E2E Org ${randomUUID()}`
        const { status, data } = await apiPost<OrganisationRow>(
            '/api/inkoopbeleid/organisations',
            { name },
            cookie,
        )
        expect(status).toBe(200)
        expect(data?.name).toBe(name)
        expect(data?.id).toBeTypeOf('string')
    })

    it.skipIf(!serverUp)('posting the same name again joins the existing organisation', async () => {
        const cookie = await loginAsAdmin()
        const name = `E2E Org ${randomUUID()}`
        const first = await apiPost<OrganisationRow>('/api/inkoopbeleid/organisations', { name }, cookie)
        const second = await apiPost<OrganisationRow>('/api/inkoopbeleid/organisations', { name }, cookie)
        expect(second.status).toBe(200)
        expect(second.data?.id).toBe(first.data?.id)
    })

    it.skipIf(!serverUp)('matching is case- and whitespace-insensitive, via the slug', async () => {
        const cookie = await loginAsAdmin()
        const base = `E2E Slug ${randomUUID()}`
        const first = await apiPost<OrganisationRow>('/api/inkoopbeleid/organisations', { name: base }, cookie)
        const second = await apiPost<OrganisationRow>(
            '/api/inkoopbeleid/organisations',
            { name: `  ${base.toUpperCase()}  ` },
            cookie,
        )
        expect(second.status).toBe(200)
        expect(second.data?.id).toBe(first.data?.id)
    })

    it.skipIf(!serverUp)('rejects a blank name', async () => {
        const cookie = await loginAsAdmin()
        const { status } = await apiPost('/api/inkoopbeleid/organisations', { name: '   ' }, cookie)
        expect(status).toBeGreaterThanOrEqual(400)
        expect(status).toBeLessThan(500)
    })

    if (!serverUp) {
        it('e2e suite skipped, no server up at TEST_BASE_URL', () => {
            expect(BASE_URL).toBeTypeOf('string')
        })
    }
})
