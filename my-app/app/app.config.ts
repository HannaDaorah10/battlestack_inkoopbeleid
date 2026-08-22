/**
 * Adjust design system · componentafspraken.
 *
 * De merkwaarden staan in `app/assets/css/main.css`; dit bestand vertaalt de
 * componentspecificaties uit het design system (maten, radii, states) naar het
 * Nuxt UI-theme. Schermen erven ze automatisch, zodat een knop overal dezelfde
 * knop is — "één component, één plek".
 */

// Uitgeschakelde staat uit het design system: grijsbeige vlak, gedempte tekst.
// Geen doorzichtig rood: een vervaagde primaire knop blijft schreeuwen.
const UITGESCHAKELD
    = 'disabled:opacity-100 aria-disabled:opacity-100 disabled:bg-adjust-uit aria-disabled:bg-adjust-uit disabled:text-adjust-uit-tekst aria-disabled:text-adjust-uit-tekst'

// Laadstaat: het accent blijft staan op 75%, de spinner en tekst zijn wit.
// `bg-primary` dekt ook Gevaar — dat is in dit merk hetzelfde rood.
const LADEN
    = 'cursor-wait disabled:bg-primary aria-disabled:bg-primary disabled:text-inverted aria-disabled:text-inverted disabled:opacity-75 aria-disabled:opacity-75'

// Tekstlink: Staal met rode onderstreping. Bewust ook voor `color="primary"`,
// want de merkregel is absoluut — lopende tekst en links zijn nooit rood.
const TEKSTLINK
    = 'text-toned hover:text-highlighted active:text-highlighted underline decoration-[var(--adj-rood)] underline-offset-[3px] font-semibold'

export default defineAppConfig({
    ui: {
        colors: {
            primary: 'adjust-rood',
            secondary: 'adjust-inkt',
            success: 'adjust-succes',
            info: 'adjust-info',
            warning: 'adjust-waarschuwing',
            // "Fouten gebruiken hetzelfde rood als het accent."
            error: 'adjust-rood',
            neutral: 'adjust-inkt',
        },

        // Knop — radius pill, 600, normaal 9/22 op 13px, groot 13/30 op 14,5px.
        button: {
            slots: {
                base: 'rounded-full font-semibold',
            },
            variants: {
                size: {
                    xs: { base: 'px-3 py-1 text-xs gap-1' },
                    sm: { base: 'px-4 py-1.5 text-sm gap-1.5' },
                    md: { base: 'px-[22px] py-[9px] text-base gap-2' },
                    lg: { base: 'px-[26px] py-[11px] text-base gap-2' },
                    xl: { base: 'px-[30px] py-[13px] text-[14.5px] gap-2' },
                },
            },
            compoundVariants: [
                // Primair — de enige rode knop op een scherm. Hover is een
                // donkerder rood (#B2241F), geen doorzichtigheid.
                {
                    color: 'primary',
                    variant: 'solid',
                    class: `bg-primary hover:bg-primary-600 active:bg-primary-600 ${UITGESCHAKELD}`,
                },
                // Gevaar deelt het accentrood; alleen de betekenis verschilt.
                {
                    color: 'error',
                    variant: 'solid',
                    class: `bg-error hover:bg-error-600 active:bg-error-600 ${UITGESCHAKELD}`,
                },
                // Secundair — wit vlak, lijn sterk, inkt-tekst.
                {
                    color: 'neutral',
                    variant: 'outline',
                    class: 'text-highlighted bg-default ring ring-inset ring-accented hover:bg-elevated active:bg-elevated',
                },
                { color: 'primary', variant: 'link', class: TEKSTLINK },
                { color: 'neutral', variant: 'link', class: TEKSTLINK },
                { color: 'secondary', variant: 'link', class: TEKSTLINK },
                // Laden is geen uitgeschakeld: de knop blijft rood op 75%, met de
                // spinner erin en "Bezig met…" als tekst. Nuxt UI zet `disabled`
                // tijdens het laden, dus het beige hierboven moet hier terug.
                {
                    color: ['primary', 'error'],
                    variant: 'solid',
                    loading: true,
                    class: LADEN,
                },
            ],
        },

        // Badge — pill, 11/600, vaste kleurparen per status, nooit klikbaar.
        badge: {
            slots: {
                base: 'rounded-full font-semibold',
            },
            variants: {
                size: {
                    xs: { base: 'text-2xs px-2 py-[2px] rounded-full' },
                    sm: { base: 'text-2xs px-2.5 py-[2px] rounded-full' },
                    md: { base: 'text-[11px] px-2.5 py-[3px] rounded-full' },
                    lg: { base: 'text-xs px-3 py-[4px] rounded-full' },
                    xl: { base: 'text-sm px-3 py-[5px] rounded-full' },
                },
            },
            defaultVariants: {
                // Tekst op een lichte tint met een rand — zoals elke badge in
                // het design system. `solid` zou grote gekleurde vlakken geven.
                variant: 'subtle',
            },
        },

        // Kaart — rand in plaats van schaduw, radius L, kaarttitel op 20/600.
        card: {
            slots: {
                root: 'rounded-lg shadow-none',
                header: 'p-5 sm:px-6',
                body: 'p-5 sm:p-6',
                footer: 'p-5 sm:px-6',
                title: 'text-highlighted font-semibold text-xl',
                description: 'mt-1 text-muted text-sm',
            },
        },

        // Invoerveld — hoogte 38, padding 10/13, radius M, veldkleur, lijn.
        input: {
            slots: { base: 'rounded-md' },
            variants: {
                size: {
                    md: { base: 'px-[13px] py-[10px] text-base/[1.4] gap-1.5' },
                    lg: { base: 'px-[13px] py-[10px] text-base/[1.4] gap-2' },
                },
                variant: {
                    outline: 'text-highlighted bg-muted ring ring-inset ring-default',
                },
            },
            compoundVariants: [
                // Focus zet de rand op inkt; de focus-ring zelf komt uit main.css.
                {
                    color: 'primary',
                    variant: 'outline',
                    class: 'focus-visible:ring-inverted',
                },
            ],
        },

        textarea: {
            slots: { base: 'rounded-md' },
            variants: {
                size: {
                    md: { base: 'px-[13px] py-[10px] text-base/[1.6]' },
                    lg: { base: 'px-[13px] py-[10px] text-base/[1.6]' },
                },
                variant: {
                    outline: 'text-highlighted bg-muted ring ring-inset ring-default',
                },
            },
            compoundVariants: [
                { color: 'primary', variant: 'outline', class: 'focus-visible:ring-inverted' },
            ],
        },

        select: {
            slots: { base: 'rounded-md' },
            variants: {
                size: {
                    md: { base: 'px-[13px] py-[10px] text-base/[1.4] gap-1.5' },
                    lg: { base: 'px-[13px] py-[10px] text-base/[1.4] gap-2' },
                },
                variant: {
                    outline: 'text-highlighted bg-muted ring ring-inset ring-default',
                },
            },
            compoundVariants: [
                { color: 'primary', variant: 'outline', class: 'focus-visible:ring-inverted' },
            ],
        },

        selectMenu: {
            slots: { base: 'rounded-md' },
            variants: {
                size: {
                    md: { base: 'px-[13px] py-[10px] text-base/[1.4] gap-1.5' },
                    lg: { base: 'px-[13px] py-[10px] text-base/[1.4] gap-2' },
                },
                variant: {
                    outline: 'text-highlighted bg-muted ring ring-inset ring-default',
                },
            },
            compoundVariants: [
                { color: 'primary', variant: 'outline', class: 'focus-visible:ring-inverted' },
            ],
        },

        // Label 12,5/600 bóven het veld, foutmelding eronder in rood.
        formField: {
            slots: {
                label: 'block font-semibold text-highlighted',
                error: 'mt-1.5 text-xs text-error',
                description: 'text-muted text-sm',
                help: 'mt-1.5 text-muted text-xs',
                hint: 'text-muted text-xs',
            },
            variants: {
                size: {
                    md: { root: 'text-sm' },
                    lg: { root: 'text-sm' },
                },
                required: {
                    true: { label: 'after:content-[\'*\'] after:ms-1 after:text-error' },
                },
            },
        },

        // Tabel — kolomkop als microlabel op een warm vlak, rijen op 13px.
        table: {
            slots: {
                thead: 'relative bg-elevated',
                th: 'px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-dimmed text-start',
                td: 'px-4 py-3 text-base text-default tabular-nums',
                tbody: 'divide-y divide-muted',
                empty: 'py-8 text-center text-sm text-muted',
            },
        },

        // Modal — maximaal 460 px, één beslissing per modal.
        modal: {
            slots: {
                title: 'text-highlighted font-semibold text-xl',
                description: 'mt-1 text-muted text-sm',
            },
            variants: {
                fullscreen: {
                    false: {
                        content: 'w-[calc(100vw-2rem)] max-w-[460px] rounded-lg shadow-lg ring ring-default',
                    },
                },
            },
        },

        // Side panel — 430 px, schuift van rechts in.
        slideover: {
            variants: {
                side: {
                    right: { content: 'right-0 inset-y-0 w-full max-w-[430px]' },
                    left: { content: 'left-0 inset-y-0 w-full max-w-[430px]' },
                },
            },
        },

        // Infoblok — radius M, zoals alle blokken die geen kaart zijn.
        alert: {
            slots: {
                root: 'rounded-md',
                title: 'text-base font-semibold',
                description: 'text-sm opacity-100',
            },
        },

        toast: {
            slots: {
                root: 'rounded-md',
                title: 'text-base font-semibold',
                description: 'text-sm text-muted',
            },
        },
    },

    // Deliberately empty: entries that depend on a feature (Dashboard, Chat, Admin group) are added by the layout, gated on
    // `runtimeConfig.public` flags the providing feature sets; a static entry here would advertise a route that may not exist.
    nav: [],
    topbar: [],
})
