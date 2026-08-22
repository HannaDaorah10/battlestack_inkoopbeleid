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
     * Fall back to the first organisation when nothing is selected, or when the stored id no
     * longer exists (a stale cookie after a reseed). Without the second check every page would
     * render an empty state that no amount of clicking could fix.
     */
    const organisationId = computed<string | null>({
        get() {
            const list = organisations.value
            if (list.length === 0) return null
            const stored = store.organisationId
            if (stored && list.some((o) => o.id === stored)) return stored
            return list[0]?.id ?? null
        },
        set(id) {
            store.setOrganisation(id)
        },
    })

    const organisation = computed(
        () => organisations.value.find((o) => o.id === organisationId.value) ?? null,
    )

    return { organisations, organisation, organisationId, status, error, refresh }
}
