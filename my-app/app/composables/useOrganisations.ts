import { useInkoopbeleidStore } from '~/stores/inkoopbeleid'

export interface OrganisationOption {
    id: string
    name: string
    slug: string
}

/**
 * The organisation list plus the currently selected one.
 *
 * Shared by every inkoopbeleid page so they all agree on which client is on screen, and so the
 * list is fetched once per navigation instead of once per page component. `useAsyncData` with a
 * fixed key is what does that de-duplication.
 */
export async function useOrganisations() {
    const store = useInkoopbeleidStore()

    // SSR cookie forward: the endpoint requires a session and would 401 during server render.
    const headers = useRequestHeaders(['cookie'])
    // Awaited, not fire-and-forget. Callers derive `organisationId` from this list and then
    // fetch their own data with it, so an unresolved list makes every page issue its first
    // request with no organisation and render empty until a watcher re-fetches on the client.
    const { data, status, error, refresh } = await useAsyncData<OrganisationOption[]>(
        'inkoopbeleid-organisations',
        () => $fetch('/api/inkoopbeleid/organisations', { headers }),
        { default: () => [] },
    )

    const organisations = computed(() => data.value ?? [])

    /**
     * Trust a stored id only while it still exists in the list (a stale cookie after a reseed
     * falls back to `null`, same as nothing stored at all). Deliberately does NOT fall back to
     * the first organisation in the list: with nobody stored yet, this visitor has not said
     * which organisation they are, and silently landing them on whichever org sorts first would
     * show them another organisation's policies. `null` here is what makes `OrganisationGate`
     * show the identify-yourself screen instead of a page.
     */
    const organisationId = computed<string | null>({
        get() {
            const stored = store.organisationId
            if (stored && organisations.value.some((o) => o.id === stored)) return stored
            return null
        },
        set(id) {
            store.setOrganisation(id)
        },
    })

    const organisation = computed(
        () => organisations.value.find((o) => o.id === organisationId.value) ?? null,
    )

    /**
     * Find-or-create an organisation by name and make it the current one. Typing an existing
     * organisation's name joins it; anything else creates it. Shared by the first-visit identity
     * screen and the header's "create new" action so both agree on what counts as "the same
     * organisation" (the server does the actual matching, by slug).
     */
    async function identifyOrganisation(name: string): Promise<OrganisationOption> {
        const created = await $fetch<OrganisationOption>('/api/inkoopbeleid/organisations', {
            method: 'POST',
            body: { name },
        })
        await refresh()
        organisationId.value = created.id
        return created
    }

    return { organisations, organisation, organisationId, identifyOrganisation, status, error, refresh }
}
