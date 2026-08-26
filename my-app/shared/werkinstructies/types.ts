/**
 * Het contentschema van een bouwsteen, zoals vastgelegd in de designhandoff
 * "Begeleide route" (`Inkoophuis design planning/design_handoff_begeleide_route/README.md`).
 *
 * De handoff is hier leidend en het uitgangspunt is niet onderhandelbaar: de werkomgeving is
 * volledig content-gedreven. Er staat nergens code die weet dat bouwsteen 0.2 vijf stappen
 * heeft of dat stap 0.2.2 gesprekken kent. Een nieuwe bouwsteen toevoegen is uitsluitend een
 * nieuw contentbestand schrijven dat aan dit schema voldoet.
 *
 * Alle tekst in dit schema is Nederlands en gaat NIET door i18n heen. Dat is dezelfde afweging
 * als bij `mandates.roleName` in `server/database/schema/inkoopbeleid.ts`: dit is de letterlijke
 * tekst van de officiele werkinstructie, geen applicatiewoordenschat. Een vertaalde
 * werkinstructie is een andere werkinstructie. De schermen eromheen (knoppen, labels, statussen)
 * lopen wel gewoon via i18n.
 */

/** Het niveau van de adviseur waarvoor de bouwsteen geschreven is. Badge op het welkomscherm. */
export type BouwsteenNiveau = 'Junior' | 'Medior' | 'Senior'

/** Een link naar een bestaand hulpmiddel elders in de app. */
export interface Hulpmiddel {
    label: string
    beschrijving: string
    /** Pad binnen de app. `:id` wordt vervangen door het id van het inkoopbeleid. */
    to: string
    icon: string
}

/**
 * Een sjabloon met richtvragen voor een gesprek, zoals de werkinstructie die meelevert bij
 * stap 0.2.2 en 0.2.4. Elke sectie wordt in het gespreksformulier een eigen notitieveld, zodat
 * de adviseur per thema vastlegt wat is opgehaald.
 */
export interface GesprekSjabloon {
    titel: string
    inleiding: string
    secties: GesprekSectie[]
}

export interface GesprekSectie {
    /** Stabiele sleutel; wordt de sleutel in `policy_step_items.answers`. Nooit hernoemen. */
    key: string
    titel: string
    vragen: string[]
}

/**
 * Een onderdeel van het stapdocument. Elk onderdeel wordt precies een werkscherm.
 *
 * De onderdelen zijn afgeleid van de "Resultaat"-opsomming van de stap: dat is per definitie
 * de lijst van wat er aan het eind van de stap moet liggen, dus is het ook de lijst van wat de
 * gebruiker onderweg invult. Zo blijft het afrondscherm ("welke onderdelen zijn gevuld?") een
 * eerlijk beeld van de Resultaat-eis uit de werkinstructie.
 */
export interface UitwerkingVeld {
    /** Stabiele sleutel; wordt `policy_step_entries.fieldKey`. Nooit hernoemen. */
    id: string
    label: string
    hint: string
    placeholder?: string
    /**
     * Index in `aanpak` die bij dit onderdeel hoort, voor het blok "Zo pak je het aan".
     * Expliciet ingevuld waar de werkinstructie een duidelijke koppeling heeft; de handoff
     * staat toe om anders terug te vallen op de positieformule.
     */
    aanpakIndex?: number
    /** Index in `aandachtspunten` voor het Tip-blok. Zelfde afweging als `aanpakIndex`. */
    tipIndex?: number
    /**
     * Maakt van dit onderdeel de lijstvariant uit implementatiebesluit 3 van de handoff: geen
     * enkel tekstvak, maar een lijst met toevoegbare items die elk het sjabloon volgen. Zo
     * krijgen de richtvragen van 0.2.2 en 0.2.4 een echte plek in de app in plaats van een
     * losse bijlage.
     */
    herhaalbaar?: {
        /** Enkelvoud, voor de knop "+ {eenheid} toevoegen". */
        eenheid: string
        /** Wat er in het titelveld van een item hoort ("Naam en rol van de stakeholder"). */
        titelLabel: string
        titelPlaceholder: string
        sjabloon: GesprekSjabloon
    }
    /** Hulpmiddel elders in de app dat bij precies dit onderdeel hoort. */
    hulpmiddel?: Hulpmiddel
}

/** Een stap uit de werkinstructie, met alle negen secties van het vaste sjabloon. */
export interface WerkinstructieStap {
    /** Stabiele sleutel; wordt `policy_step_entries.stepKey`. Nooit hernoemen. */
    id: string
    /** Het nummer waarmee een lezer de stap aanhaalt, bijvoorbeeld "0.2.1". */
    number: string
    title: string
    doelgroep: string
    kern: string
    vervolg: string
    doel: string[]
    benodigdeInput: string[]
    aanpak: string[]
    resultaatIntro: string
    resultaat: string[]
    templatesTekst: string
    kwaliteitscriteria: string[]
    controlevragen: string[]
    aandachtspunten: string[]
    documentTitel: string
    documentSoort: string
    uitwerking: UitwerkingVeld[]
    /**
     * De status waarin het inkoopbeleid staat terwijl deze stap loopt. Koppelt de route aan
     * `policies.status`, die deze vijf stappen al een-op-een als enum kent. Zonder deze
     * koppeling zouden de route en de statusknoppen op de detailpagina langs elkaar heen
     * werken.
     */
    status: string
}

export interface Bouwsteen {
    /** "0.2" */
    number: string
    title: string
    /** De kamer van het inkoophuis waar de bouwsteen in hangt. */
    roomTitle: string
    niveau: BouwsteenNiveau
    /** Twee korte alinea's op het welkomscherm. */
    introductie: string[]
    eindresultaat: string
    /** Blok "Hulpmiddelen en templates" op het welkomscherm (implementatiebesluit 4). */
    hulpmiddelen: Hulpmiddel[]
    stappen: WerkinstructieStap[]
}
