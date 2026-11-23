import { defineStore } from 'pinia'

/**
 * Which organisation the user is currently looking at.
 *
 * Cookie-backed (`persist: true`, the Pinia module default) so the choice survives a reload and
 * SSR renders the same organisation the client will, with no flash of the wrong client's data.
 *
 * This is a VIEW preference, not a permission. Every request still sends `organisationId`
 * explicitly and every server route validates it through `requireOrganisation`, so tampering
 * with the cookie changes what you asked for, never what you are allowed to see. Real
 * per-organisation authorisation belongs on the server when a membership model exists.
 */
export const useInkoopbeleidStore = defineStore('inkoopbeleid', {
    state: () => ({
        organisationId: null as string | null,
    }),
    actions: {
        setOrganisation(id: string | null) {
            this.organisationId = id
        },
    },
    persist: true,
})
