import { describe, expect, it } from 'vitest'
import { BOUWSTEEN_INKOOPBELEID } from '#shared/werkinstructies/bouwsteen-0-2'
import {
    aanpakVoorTaak,
    doorlopenSchermen,
    schermenVoorStap,
    sectieVoorScherm,
    tipVoorTaak,
    totaalSchermen,
    volgendePositie,
    voortgangPercentage,
    vorigePositie,
} from '#shared/werkinstructies/schermen'
import type { Bouwsteen, WerkinstructieStap } from '#shared/werkinstructies/types'

const bouwsteen = BOUWSTEEN_INKOOPBELEID

/** Een minimale stap, om de vorm te testen zonder van de echte content af te hangen. */
function stapMet(overschrijf: Partial<WerkinstructieStap>): WerkinstructieStap {
    return {
        id: 'test',
        number: '9.9.9',
        title: 'Test',
        status: 'analyse',
        doelgroep: '',
        kern: '',
        vervolg: '',
        doel: [],
        benodigdeInput: [],
        aanpak: [],
        resultaatIntro: '',
        resultaat: [],
        templatesTekst: '',
        kwaliteitscriteria: [],
        controlevragen: [],
        aandachtspunten: [],
        documentTitel: '',
        documentSoort: '',
        uitwerking: [],
        ...overschrijf,
    }
}

describe('schermenVoorStap', { timeout: 120_000 }, () => {
    it('omsluit de werkschermen met start, input, controle en afronden', () => {
        const stap = stapMet({
            uitwerking: [
                { id: 'a', label: 'A', hint: '' },
                { id: 'b', label: 'B', hint: '' },
            ],
        })

        expect(schermenVoorStap(stap).map((s) => s.soort)).toEqual([
            'intro', 'input', 'taak', 'taak', 'controle', 'afronden',
        ])
    })

    it('geeft een werkscherm zijn onderdeel-index mee', () => {
        const stap = stapMet({
            uitwerking: [
                { id: 'a', label: 'A', hint: '' },
                { id: 'b', label: 'B', hint: '' },
            ],
        })
        const taken = schermenVoorStap(stap).filter((s) => s.soort === 'taak')

        expect(taken.map((s) => s.taakIndex)).toEqual([0, 1])
        expect(taken.map((s) => s.label)).toEqual(['A', 'B'])
    })

    it('houdt vier vaste schermen over als een stap geen onderdelen heeft', () => {
        expect(schermenVoorStap(stapMet({})).length).toBe(4)
    })
})

describe('voortgang', { timeout: 120_000 }, () => {
    it('telt het huidige scherm niet mee als doorlopen', () => {
        expect(doorlopenSchermen(bouwsteen, { stapIndex: 0, schermIndex: 0 })).toBe(0)
    })

    it('telt alle schermen van eerdere stappen mee', () => {
        const eerste = schermenVoorStap(bouwsteen.stappen[0]!).length
        expect(doorlopenSchermen(bouwsteen, { stapIndex: 1, schermIndex: 0 })).toBe(eerste)
    })

    it('staat op 0 procent aan het begin en op 100 op het laatste scherm', () => {
        expect(voortgangPercentage(bouwsteen, { stapIndex: 0, schermIndex: 0 })).toBe(0)

        const laatsteStap = bouwsteen.stappen.length - 1
        const laatsteScherm = schermenVoorStap(bouwsteen.stappen[laatsteStap]!).length - 1
        // Op het laatste scherm liggen alle schermen op dat ene na achter je.
        const bijna = voortgangPercentage(bouwsteen, {
            stapIndex: laatsteStap,
            schermIndex: laatsteScherm,
        })
        expect(bijna).toBeGreaterThan(90)
        expect(bijna).toBeLessThan(100)
    })

    it('deelt niet door nul bij een bouwsteen zonder stappen', () => {
        const leeg: Bouwsteen = { ...bouwsteen, stappen: [] }
        expect(totaalSchermen(leeg)).toBe(0)
        expect(voortgangPercentage(leeg, { stapIndex: 0, schermIndex: 0 })).toBe(0)
    })
})

describe('navigatie', { timeout: 120_000 }, () => {
    it('loopt aan het eind van een stap door naar scherm 0 van de volgende', () => {
        const laatsteVanEerste = schermenVoorStap(bouwsteen.stappen[0]!).length - 1

        expect(volgendePositie(bouwsteen, { stapIndex: 0, schermIndex: laatsteVanEerste }))
            .toEqual({ stapIndex: 1, schermIndex: 0 })
    })

    it('loopt terug naar het laatste scherm van de vorige stap', () => {
        const laatsteVanEerste = schermenVoorStap(bouwsteen.stappen[0]!).length - 1

        expect(vorigePositie(bouwsteen, { stapIndex: 1, schermIndex: 0 }))
            .toEqual({ stapIndex: 0, schermIndex: laatsteVanEerste })
    })

    it('heeft geen volgende na het laatste scherm van de laatste stap', () => {
        const laatsteStap = bouwsteen.stappen.length - 1
        const laatsteScherm = schermenVoorStap(bouwsteen.stappen[laatsteStap]!).length - 1

        expect(volgendePositie(bouwsteen, { stapIndex: laatsteStap, schermIndex: laatsteScherm }))
            .toBeNull()
    })

    it('heeft geen vorige op het allereerste scherm', () => {
        expect(vorigePositie(bouwsteen, { stapIndex: 0, schermIndex: 0 })).toBeNull()
    })
})

describe('koppeling werkscherm aan werkinstructie', { timeout: 120_000 }, () => {
    it('gebruikt de expliciete aanpakIndex uit de content', () => {
        const stap = stapMet({
            aanpak: ['eerste', 'tweede', 'derde'],
            uitwerking: [{ id: 'a', label: 'A', hint: '', aanpakIndex: 2 }],
        })

        expect(aanpakVoorTaak(stap, 0)).toBe('derde')
    })

    it('valt zonder expliciete koppeling terug op de positieformule', () => {
        const stap = stapMet({
            aanpak: ['eerste', 'tweede'],
            uitwerking: [
                { id: 'a', label: 'A', hint: '' },
                { id: 'b', label: 'B', hint: '' },
                { id: 'c', label: 'C', hint: '' },
            ],
        })

        // Meer onderdelen dan aanpak-regels: het laatste onderdeel blijft op de laatste regel
        // staan in plaats van buiten de lijst te wijzen.
        expect(aanpakVoorTaak(stap, 0)).toBe('eerste')
        expect(aanpakVoorTaak(stap, 2)).toBe('tweede')
    })

    it('laat een tipIndex buiten bereik binnen de lijst vallen', () => {
        const stap = stapMet({
            aandachtspunten: ['let op dit'],
            uitwerking: [{ id: 'a', label: 'A', hint: '', tipIndex: 99 }],
        })

        expect(tipVoorTaak(stap, 0)).toBe('let op dit')
    })

    it('geeft lege tekst terug als de stap geen aanpak of aandachtspunten heeft', () => {
        const stap = stapMet({ uitwerking: [{ id: 'a', label: 'A', hint: '' }] })

        expect(aanpakVoorTaak(stap, 0)).toBe('')
        expect(tipVoorTaak(stap, 0)).toBe('')
    })

    it('opent per schermsoort de sectie die daarbij hoort', () => {
        expect(sectieVoorScherm('intro')).toBe('doel')
        expect(sectieVoorScherm('input')).toBe('benodigdeInput')
        expect(sectieVoorScherm('taak')).toBe('aanpak')
        expect(sectieVoorScherm('controle')).toBe('controlevragen')
        expect(sectieVoorScherm('afronden')).toBe('kwaliteitscriteria')
    })
})

describe('de content van bouwsteen 0.2', { timeout: 120_000 }, () => {
    it('heeft de vijf stappen 0.2.1 tot en met 0.2.5', () => {
        expect(bouwsteen.stappen.map((s) => s.number))
            .toEqual(['0.2.1', '0.2.2', '0.2.3', '0.2.4', '0.2.5'])
    })

    it('koppelt elke stap aan een status van policies.status', () => {
        expect(bouwsteen.stappen.map((s) => s.status))
            .toEqual(['analyse', 'herijken', 'opstellen', 'bespreken', 'vastgesteld'])
    })

    it('gebruikt overal unieke sleutels, zodat opgeslagen werk nooit botst', () => {
        const stapSleutels = bouwsteen.stappen.map((s) => s.id)
        expect(new Set(stapSleutels).size).toBe(stapSleutels.length)

        for (const stap of bouwsteen.stappen) {
            const veldSleutels = stap.uitwerking.map((v) => v.id)
            expect(new Set(veldSleutels).size, `dubbele sleutel in ${stap.number}`)
                .toBe(veldSleutels.length)
        }
    })

    it('houdt elke expliciete aanpakIndex en tipIndex binnen zijn lijst', () => {
        for (const stap of bouwsteen.stappen) {
            for (const veld of stap.uitwerking) {
                if (veld.aanpakIndex !== undefined) {
                    expect(veld.aanpakIndex, `${stap.number}/${veld.id}`)
                        .toBeLessThan(stap.aanpak.length)
                }
                if (veld.tipIndex !== undefined) {
                    expect(veld.tipIndex, `${stap.number}/${veld.id}`)
                        .toBeLessThan(stap.aandachtspunten.length)
                }
            }
        }
    })

    it('geeft alleen 0.2.2 en 0.2.4 een herhaalbaar onderdeel met richtvragen', () => {
        const metGesprekken = bouwsteen.stappen
            .filter((s) => s.uitwerking.some((v) => v.herhaalbaar))
            .map((s) => s.number)

        expect(metGesprekken).toEqual(['0.2.2', '0.2.4'])
    })

    it('geeft elk richtvragen-sjabloon unieke sectiesleutels', () => {
        for (const stap of bouwsteen.stappen) {
            for (const veld of stap.uitwerking) {
                if (!veld.herhaalbaar) continue
                const keys = veld.herhaalbaar.sjabloon.secties.map((s) => s.key)
                expect(new Set(keys).size, `${stap.number}/${veld.id}`).toBe(keys.length)
            }
        }
    })

    it('dekt elke resultaatregel met minstens een eigen onderdeel', () => {
        /**
         * De onderdelen zijn afgeleid van de Resultaat-opsomming, maar niet een-op-een.
         *
         * 0.2.2 en 0.2.4 hebben er een herhaalbaar gesprekken-onderdeel bij, en 0.2.4 daarnaast
         * een eigen scherm voor de plenaire bespreking: de werkinstructie plaatst die
         * nadrukkelijk na de individuele ronde, dus die twee mogen niet in een veld samenvallen.
         *
         * De aantallen staan hier hard, zodat het opschuiven of wegvallen van een resultaatregel
         * opvalt in plaats van stil door te werken naar een afrondscherm dat te weinig toont.
         */
        const verwacht: Record<string, number> = {
            '0.2.1': 6,
            '0.2.2': 7,
            '0.2.3': 8,
            '0.2.4': 8,
            '0.2.5': 6,
        }

        for (const stap of bouwsteen.stappen) {
            expect(stap.uitwerking.length, `stap ${stap.number}`).toBe(verwacht[stap.number])
            expect(stap.uitwerking.length, `stap ${stap.number}`)
                .toBeGreaterThanOrEqual(stap.resultaat.length)
        }
    })
})
