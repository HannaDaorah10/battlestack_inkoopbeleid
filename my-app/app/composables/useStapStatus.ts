import type { Bouwsteen } from '#shared/werkinstructies/types'
import { schermenVoorStap } from '#shared/werkinstructies/schermen'

export type StapStatus = 'afgerond' | 'bezig' | 'nietGestart'

interface StapStatusOpties {
    opslagSleutel: MaybeRefOrGetter<string>
    bouwsteen: Bouwsteen
    stapIndex: Ref<number>
    schermIndex: Ref<number>
    /** Of de huidige positie als bezoek telt. Op een welkomscherm nog niet. */
    actief?: MaybeRefOrGetter<boolean>
    /** Stappen voor deze index gelden altijd als afgerond, omdat de status al verder is. */
    afgerondTot?: MaybeRefOrGetter<number>
}

/**
 * Welke stappen van de route geopend zijn en welke afgerond, voor de bolletjes in de reisbalk.
 *
 * Een stap is geopend zodra er een scherm van getoond is en afgerond zodra de gebruiker het
 * afrondscherm (het laatste scherm) heeft bereikt. Op positie afleiden kan niet: wie terugspringt
 * naar stap 2 zou stap 3 en 4 dan weer grijs zien, en een overgeslagen stap zou groen worden.
 *
 * Net als de positie in `localStorage`, per browser. Bestaat er nog niets, dan gelden de stappen
 * voor de huidige positie als afgerond; zo verandert er niets voor wie al onderweg was.
 */
export function useStapStatus(opties: StapStatusOpties) {
    const geopend = ref<Set<string>>(new Set())
    const afgerond = ref<Set<string>>(new Set())
    let hersteld = false

    function bewaar() {
        try {
            window.localStorage.setItem(
                toValue(opties.opslagSleutel),
                JSON.stringify({ geopend: [...geopend.value], afgerond: [...afgerond.value] }),
            )
        } catch {
            // Geblokkeerde opslag: de bolletjes kloppen dan alleen binnen deze sessie.
        }
    }

    function registreer() {
        if (!import.meta.client || !hersteld) return
        if (!(toValue(opties.actief) ?? true)) return
        const stap = opties.bouwsteen.stappen[opties.stapIndex.value]
        if (!stap) return
        let gewijzigd = false
        if (!geopend.value.has(stap.id)) {
            geopend.value = new Set(geopend.value).add(stap.id)
            gewijzigd = true
        }
        const laatste = schermenVoorStap(stap).length - 1
        if (opties.schermIndex.value >= laatste && !afgerond.value.has(stap.id)) {
            afgerond.value = new Set(afgerond.value).add(stap.id)
            gewijzigd = true
        }
        if (gewijzigd) bewaar()
    }

    function herstel() {
        try {
            const rauw = window.localStorage.getItem(toValue(opties.opslagSleutel))
            if (rauw) {
                const bewaard = JSON.parse(rauw) as { geopend?: string[], afgerond?: string[] }
                geopend.value = new Set(bewaard.geopend ?? [])
                afgerond.value = new Set(bewaard.afgerond ?? [])
            } else if (toValue(opties.actief) ?? true) {
                const eerder = opties.bouwsteen.stappen
                    .slice(0, opties.stapIndex.value)
                    .map((s) => s.id)
                geopend.value = new Set(eerder)
                afgerond.value = new Set(eerder)
            }
        } catch {
            // Onleesbare opslag: begin met een schone lei.
        }
        hersteld = true
        registreer()
    }

    onMounted(herstel)
    watch([opties.stapIndex, opties.schermIndex, () => toValue(opties.actief)], registreer)

    function stapStatus(i: number): StapStatus {
        const stap = opties.bouwsteen.stappen[i]
        if (!stap) return 'nietGestart'
        if (i < (toValue(opties.afgerondTot) ?? 0) || afgerond.value.has(stap.id)) return 'afgerond'
        if (geopend.value.has(stap.id)) return 'bezig'
        return 'nietGestart'
    }

    return { stapStatus }
}
