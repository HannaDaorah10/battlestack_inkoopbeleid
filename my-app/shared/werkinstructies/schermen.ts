import type { Bouwsteen, WerkinstructieStap } from './types'

/**
 * De schermreeks van een begeleide route, als pure functies.
 *
 * De designhandoff schrijft de vorm voor en laat het aantal schermen volledig uit de content
 * volgen: Start, Input verzamelen, een werkscherm per uitwerking-onderdeel, Controleer jezelf,
 * Afronden. Er staat hier dus nergens een getal dat weet hoeveel stappen bouwsteen 0.2 heeft.
 *
 * Bewust vrij van Vue en van de database: dit is rekenwerk over content, en zo is het los te
 * testen zonder component of verbinding. Zie `test/unit/werkroute-schermen.test.ts`.
 */

export type SchermSoort = 'intro' | 'input' | 'taak' | 'controle' | 'afronden'

export interface Scherm {
    soort: SchermSoort
    /** Wat er in de reisbalk en in de "Jij bent hier"-regel staat. */
    label: string
    /** Alleen bij `soort: 'taak'`: de index in `stap.uitwerking`. */
    taakIndex?: number
}

/** Waar de gebruiker is: een stap plus een scherm binnen die stap. */
export interface Positie {
    stapIndex: number
    schermIndex: number
}

/**
 * De schermen van een stap, afgeleid uit zijn content.
 *
 * De labels van de werkschermen zijn de labels van de uitwerking-onderdelen zelf, zodat de
 * subroute in de reisbalk leest als de inhoudsopgave van het stapdocument dat je aan het
 * opbouwen bent.
 */
export function schermenVoorStap(stap: WerkinstructieStap): Scherm[] {
    return [
        { soort: 'intro', label: 'Start' },
        { soort: 'input', label: 'Input verzamelen' },
        ...stap.uitwerking.map((veld, i): Scherm => ({
            soort: 'taak',
            label: veld.label,
            taakIndex: i,
        })),
        { soort: 'controle', label: 'Controleer jezelf' },
        { soort: 'afronden', label: 'Afronden' },
    ]
}

/** Alle schermen van de hele bouwsteen bij elkaar opgeteld. */
export function totaalSchermen(bouwsteen: Bouwsteen): number {
    return bouwsteen.stappen.reduce((som, stap) => som + schermenVoorStap(stap).length, 0)
}

/**
 * Hoeveel schermen er achter de gebruiker liggen.
 *
 * Het huidige scherm telt niet mee: je hebt het nog niet gedaan, je staat erop. Daardoor is de
 * balk leeg op het allereerste scherm en vol op het allerlaatste, wat is wat een voortgangsbalk
 * hoort te doen.
 */
export function doorlopenSchermen(bouwsteen: Bouwsteen, positie: Positie): number {
    const voorgaande = bouwsteen.stappen
        .slice(0, positie.stapIndex)
        .reduce((som, stap) => som + schermenVoorStap(stap).length, 0)
    return voorgaande + positie.schermIndex
}

/** De voortgang over de hele bouwsteen, als afgerond percentage. */
export function voortgangPercentage(bouwsteen: Bouwsteen, positie: Positie): number {
    const totaal = totaalSchermen(bouwsteen)
    if (totaal === 0) return 0
    return Math.round((doorlopenSchermen(bouwsteen, positie) / totaal) * 100)
}

/**
 * Het volgende scherm, of `null` als de bouwsteen klaar is.
 *
 * Aan het eind van een stap springt de route naar scherm 0 van de volgende stap, precies zoals
 * de handoff beschrijft.
 */
export function volgendePositie(bouwsteen: Bouwsteen, positie: Positie): Positie | null {
    const stap = bouwsteen.stappen[positie.stapIndex]
    if (!stap) return null
    if (positie.schermIndex < schermenVoorStap(stap).length - 1) {
        return { stapIndex: positie.stapIndex, schermIndex: positie.schermIndex + 1 }
    }
    if (positie.stapIndex < bouwsteen.stappen.length - 1) {
        return { stapIndex: positie.stapIndex + 1, schermIndex: 0 }
    }
    return null
}

/** Het vorige scherm, of `null` als de gebruiker helemaal aan het begin staat. */
export function vorigePositie(bouwsteen: Bouwsteen, positie: Positie): Positie | null {
    if (positie.schermIndex > 0) {
        return { stapIndex: positie.stapIndex, schermIndex: positie.schermIndex - 1 }
    }
    if (positie.stapIndex > 0) {
        const vorigeStap = bouwsteen.stappen[positie.stapIndex - 1]
        if (!vorigeStap) return null
        return {
            stapIndex: positie.stapIndex - 1,
            schermIndex: schermenVoorStap(vorigeStap).length - 1,
        }
    }
    return null
}

/**
 * De aanpak-regel bij een werkscherm.
 *
 * De content mag een expliciete koppeling meegeven (`aanpakIndex`); dat is hier het geval voor
 * bouwsteen 0.2, waar aanpak en uitwerking niet dezelfde volgorde hebben. Zonder expliciete
 * koppeling valt de functie terug op de positieformule uit de handoff.
 */
export function aanpakVoorTaak(stap: WerkinstructieStap, taakIndex: number): string {
    if (stap.aanpak.length === 0) return ''
    const veld = stap.uitwerking[taakIndex]
    const index = veld?.aanpakIndex ?? Math.min(taakIndex, stap.aanpak.length - 1)
    return stap.aanpak[Math.min(Math.max(index, 0), stap.aanpak.length - 1)] ?? ''
}

/** Het aandachtspunt bij een werkscherm. Zelfde afweging als {@link aanpakVoorTaak}. */
export function tipVoorTaak(stap: WerkinstructieStap, taakIndex: number): string {
    if (stap.aandachtspunten.length === 0) return ''
    const veld = stap.uitwerking[taakIndex]
    const index = veld?.tipIndex ?? taakIndex % stap.aandachtspunten.length
    return stap.aandachtspunten[Math.min(Math.max(index, 0), stap.aandachtspunten.length - 1)] ?? ''
}

/** De negen secties van het werkinstructiepaneel, in de volgorde van de handoff. */
export const INSTRUCTIE_SECTIES = [
    'doel',
    'benodigdeInput',
    'aanpak',
    'resultaat',
    'templates',
    'aandachtspunten',
    'controlevragen',
    'kwaliteitscriteria',
    'rolEnContext',
] as const

export type InstructieSectie = (typeof INSTRUCTIE_SECTIES)[number]

/**
 * Welke sectie van het werkinstructiepaneel automatisch openklapt bij dit scherm.
 *
 * Dit is kernprincipe 2 van de handoff, "de werkinstructie komt naar de gebruiker toe": bij het
 * input-scherm hoort Benodigde input, bij een werkscherm de Aanpak, enzovoort. De gebruiker
 * hoeft niet te zoeken welk deel van de instructie nu relevant is.
 */
export function sectieVoorScherm(soort: SchermSoort): InstructieSectie {
    switch (soort) {
        case 'input': return 'benodigdeInput'
        case 'taak': return 'aanpak'
        case 'controle': return 'controlevragen'
        case 'afronden': return 'kwaliteitscriteria'
        case 'intro': return 'doel'
    }
}
