<template>
    <div class="min-h-screen lg:grid lg:grid-cols-[var(--adj-sidebar-breedte)_1fr]">
        <!-- Mobiele balk: onder lg past de vaste sidebar niet, dus staat het logo
             in een inkt-balk en schuift de navigatie er als paneel overheen. -->
        <div class="flex items-center justify-between bg-inverted px-4 py-3 lg:hidden">
            <NuxtLink
                to="/"
                :aria-label="appName"
            >
                <img
                    src="/img/adjust-logo-diap.png"
                    alt="Adjust"
                    class="block w-[76px]"
                />
            </NuxtLink>
            <button
                type="button"
                class="flex size-9 items-center justify-center rounded-sm text-white/70 hover:bg-white/10 hover:text-white"
                :aria-label="t('shell.openMenu')"
                :aria-expanded="menuOpen"
                @click="menuOpen = true"
            >
                <UIcon
                    name="i-lucide-menu"
                    class="size-5"
                />
            </button>
        </div>

        <!-- Achtergrond van het mobiele paneel -->
        <div
            v-if="menuOpen"
            class="fixed inset-0 z-40 bg-inverted/50 lg:hidden"
            @click="menuOpen = false"
        />

        <nav
            class="fixed inset-y-0 left-0 z-50 flex w-[var(--adj-sidebar-breedte)] flex-col overflow-y-auto bg-inverted px-3.5 py-6 transition-transform lg:static lg:z-auto lg:translate-x-0"
            :class="menuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
            :aria-label="t('shell.mainNavigation')"
        >
            <div class="mb-5 flex items-start justify-between gap-2 ps-2">
                <!-- Het logo staat één keer per scherm, linksboven in de navigatie. -->
                <NuxtLink
                    to="/"
                    :aria-label="appName"
                >
                    <img
                        src="/img/adjust-logo-diap.png"
                        alt="Adjust"
                        class="block w-[88px]"
                    />
                </NuxtLink>
                <button
                    type="button"
                    class="-me-1 flex size-7 items-center justify-center rounded-sm text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
                    :aria-label="t('shell.closeMenu')"
                    @click="menuOpen = false"
                >
                    <UIcon
                        name="i-lucide-x"
                        class="size-4"
                    />
                </button>
            </div>

            <ul class="flex flex-col gap-0.5">
                <li
                    v-for="item in nav"
                    :key="item.to"
                >
                    <NuxtLink
                        :to="item.to"
                        class="flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm transition-colors"
                        :class="isActive(item.to)
                            ? 'bg-white/[0.09] font-semibold text-white'
                            : 'text-white/55 hover:text-white'"
                        :aria-current="isActive(item.to) ? 'page' : undefined"
                        @click="menuOpen = false"
                    >
                        <UIcon
                            :name="item.icon"
                            class="size-[18px] shrink-0"
                        />
                        {{ item.label }}
                    </NuxtLink>

                    <!-- Eén niveau subnavigatie, alleen uitgeklapt binnen de sectie
                         zelf. Tabs schakelen weergaven bínnen een pagina — nooit
                         tussen pagina's; daarvoor is de sidebar. -->
                    <ul
                        v-if="item.children?.length && inSection(item.to)"
                        class="mt-0.5 mb-1 ml-[13px] flex flex-col gap-0.5 border-l border-white/15 pl-3"
                    >
                        <li
                            v-for="child in item.children"
                            :key="child.to"
                        >
                            <NuxtLink
                                :to="child.to"
                                class="block rounded-sm px-2.5 py-1.5 text-sm transition-colors"
                                :class="isActive(child.to)
                                    ? 'bg-white/[0.09] font-semibold text-white'
                                    : 'text-white/55 hover:text-white'"
                                :aria-current="isActive(child.to) ? 'page' : undefined"
                                @click="menuOpen = false"
                            >
                                {{ child.label }}
                            </NuxtLink>
                        </li>
                    </ul>
                </li>
            </ul>

            <!-- Beheer is de tweede groep; ook hier maar één niveau diep. -->
            <template v-if="adminChildren.length > 0">
                <p class="mt-6 mb-1.5 px-2.5 text-2xs font-bold tracking-[0.12em] text-white/35 uppercase">
                    {{ t('shell.admin') }}
                </p>
                <ul class="flex flex-col gap-0.5">
                    <li
                        v-for="item in adminChildren"
                        :key="item.to"
                    >
                        <NuxtLink
                            :to="item.to"
                            class="flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm transition-colors"
                            :class="isActive(item.to)
                                ? 'bg-white/[0.09] font-semibold text-white'
                                : 'text-white/55 hover:text-white'"
                            :aria-current="isActive(item.to) ? 'page' : undefined"
                            @click="menuOpen = false"
                        >
                            <UIcon
                                :name="item.icon"
                                class="size-[18px] shrink-0"
                            />
                            {{ item.label }}
                        </NuxtLink>
                    </li>
                </ul>
            </template>

            <div class="flex-1" />

            <UDropdownMenu
                v-if="showAvatar"
                :items="avatarMenu"
                :content="{ side: 'top', align: 'start' }"
            >
                <button
                    type="button"
                    :aria-label="t('shell.accountMenu')"
                    class="mt-6 flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-start hover:bg-white/[0.09]"
                >
                    <span
                        class="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-adjust-zand-400 text-2xs font-bold text-adjust-inkt-700"
                    >
                        <!-- Decoratief: de knop draagt de toegankelijke naam al via `aria-label`. `users.name` is nullable, dus
                             `:alt` eraan binden zou juist de gebruikers met een avatar een lege naam geven. -->
                        <img
                            v-if="avatarUrl"
                            :src="avatarUrl"
                            alt=""
                            class="h-full w-full object-cover"
                        />
                        <span v-else>{{ userInitials }}</span>
                    </span>
                    <span class="min-w-0 flex-1 truncate text-sm text-white/70">{{ userName }}</span>
                    <UIcon
                        name="i-lucide-chevron-up"
                        class="size-4 shrink-0 text-white/40"
                    />
                </button>
            </UDropdownMenu>
        </nav>

        <!-- Schermen die de volle breedte nodig hebben, zoals de begeleide route met zijn
             eigen routebalk en zijpaneel, zetten `fullBleed` in `definePageMeta`. Zonder die
             uitzondering zou zo een scherm binnen de 1080px van een gewone dashboardpagina
             worden geperst en zijn drie kolommen kwijtraken. -->
        <main :class="fullBleed ? 'min-w-0' : 'px-4 py-6 sm:px-6 lg:px-11 lg:pt-9 lg:pb-16'">
            <div :class="fullBleed ? 'h-full' : 'mx-auto w-full max-w-[1080px]'">
                <slot />
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
const config = useAppConfig()
const runtimeConfig = useRuntimeConfig()
const route = useRoute()
const { t } = useI18n()

// Read from `runtimeConfig.public.appName`, not `useAppConfig()`: the scaffolder writes the project name to the former
// (`features/nuxt-ui.ts`); reading from `useAppConfig()` fell through to the literal fallback, showing "App" in the header.
const appName = computed(
    () => (runtimeConfig.public.appName as string | undefined) || 'App',
)

const fullBleed = computed(() => route.meta.fullBleed === true)

// Alleen voor het mobiele paneel; op lg staat de sidebar altijd vast.
const menuOpen = ref(false)
watch(() => route.path, () => (menuOpen.value = false))

const session = useUserSession()
const showAvatar = computed(() => !!session.loggedIn.value)
const userName = computed(
    () => session.user.value?.name || session.user.value?.email || '',
)
const userInitials = computed(() => {
    const name = String(session.user.value?.name ?? session.user.value?.email ?? '?')
    return name
        .split(/\s+/)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
})

// Shared with `dashboard/profile.vue` via the `battlestack-avatar-url` useState key; upload/delete writes it, we read it here.
// Endpoint exists only when `nuxt:storage` is installed; failure is silent.
const avatarUrl = useState<string | null>('battlestack-avatar-url', () => null)
onMounted(async () => {
    if (!session.loggedIn.value) return
    if (avatarUrl.value) return
    try {
        const r = await $fetch<{ avatarUrl: string | null }>('/api/auth/avatar')
        avatarUrl.value = r.avatarUrl
    } catch {
        // no storage feature installed or no avatar yet
    }
})

const isAdmin = computed(
    () => (session.user.value as { role?: string } | null | undefined)?.role === 'admin',
)

const { logout } = useAuth()
async function onSignOut() {
    await logout()
}

const avatarMenu = computed(() => [
    [
        { label: t('shell.profile'), to: '/dashboard/profile', icon: 'i-lucide-user' },
        { label: t('shell.security'), to: '/dashboard/security', icon: 'i-lucide-shield' },
    ],
    [
        { label: t('shell.signOut'), onSelect: onSignOut, icon: 'i-lucide-log-out' },
    ],
])

const publicFlags = computed(
    () =>
        runtimeConfig.public as {
            dashboard?: boolean
            userAdmin?: boolean
            mastraAdmin?: boolean
            promptMgmt?: boolean
            chat?: boolean
            rag?: boolean
            inkoopbeleid?: boolean
        },
)

interface NavItem { to: string, icon: string, label: string, children?: NavItem[] }

const nav = computed<NavItem[]>(() => {
    const base = [...((config.nav ?? []) as NavItem[])]

    // Gated, not hardcoded in `app.config.ts`: `nuxt4:landing-shell` is default-on in `nuxt4-minimal`, which never installs
    // `nuxt4:dashboard-shell`; a static entry advertised a route the scaffold never emits, so the whole bar 404'd.
    if (publicFlags.value.dashboard) {
        base.push({
            label: t('shell.dashboard'),
            to: '/dashboard',
            icon: 'i-lucide-layout-dashboard',
        })
    }

    if (publicFlags.value.chat) {
        base.push({
            label: t('shell.chat'),
            to: '/chat',
            icon: 'i-lucide-message-circle',
        })
    }

    // Top-level, not under Admin: the procurement advisor is for the adviseur inkoop and for
    // any employee asking "what do I have to do for this purchase?", neither of whom is an
    // administrator of this application.
    if (publicFlags.value.inkoopbeleid) {
        base.push({
            label: t('shell.inkoopbeleid'),
            to: '/dashboard/inkoopbeleid',
            icon: 'i-lucide-scale',
            // Verhuisd uit `OrganisationSwitcher`, waar dit een rij tabknoppen was
            // die tussen pagina's schakelde — dat is werk voor de sidebar.
            children: [
                { label: t('shell.inkoopbeleidNav.documents'), to: '/dashboard/inkoopbeleid/documenten', icon: 'i-lucide-file-text' },
                { label: t('shell.inkoopbeleidNav.advisor'), to: '/dashboard/inkoopbeleid/adviseur', icon: 'i-lucide-message-circle-question' },
                { label: t('shell.inkoopbeleidNav.check'), to: '/dashboard/inkoopbeleid/toets', icon: 'i-lucide-calculator' },
                { label: t('shell.inkoopbeleidNav.deviations'), to: '/dashboard/inkoopbeleid/afwijkingen', icon: 'i-lucide-triangle-alert' },
            ],
        })
    }

    return base
})

const adminChildren = computed<NavItem[]>(() => {
    if (!isAdmin.value) return []
    const children: NavItem[] = []
    if (publicFlags.value.userAdmin) {
        children.push({
            label: t('shell.users'),
            to: '/dashboard/users',
            icon: 'i-lucide-users',
        })
    }
    if (publicFlags.value.mastraAdmin) {
        children.push({
            label: t('shell.ai'),
            to: '/dashboard/settings/ai',
            icon: 'i-lucide-bot',
        })
    }
    if (publicFlags.value.promptMgmt) {
        children.push({
            label: t('shell.prompts'),
            to: '/dashboard/prompts',
            icon: 'i-lucide-message-square-text',
        })
    }
    if (publicFlags.value.rag) {
        children.push({
            label: t('shell.rag'),
            to: '/dashboard/rag',
            icon: 'i-lucide-library-big',
        })
    }
    return children
})

// `/dashboard` is het prefix van elk ander item, dus alleen een exacte match telt daar.
// Hetzelfde geldt voor items met subnavigatie: die subpagina's hebben hun eigen
// item eronder, dus lichten ze de sectiekop niet mee op.
function isActive(to: string): boolean {
    if (route.path === to) return true
    if (to === '/dashboard' || to === '/dashboard/inkoopbeleid') return false
    return route.path.startsWith(`${to}/`)
}

/** Staan we ergens binnen deze sectie? Bepaalt of de subnavigatie uitklapt. */
function inSection(to: string): boolean {
    return route.path === to || route.path.startsWith(`${to}/`)
}
</script>
