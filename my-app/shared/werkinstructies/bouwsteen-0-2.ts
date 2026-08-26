import type { Bouwsteen, GesprekSjabloon, Hulpmiddel } from './types'

/**
 * Bouwsteen 0.2 Inkoopbeleid, als content.
 *
 * Bron: de vijf officiele werkinstructies 0.2.1 t/m 0.2.5, samengevat in
 * `Inkoopbeleid_werkinstructies/werkinstructies.md`. De Nederlandse tekst van Doel, Benodigde
 * input, Aanpak, Resultaat, Kwaliteitscriteria, Controlevragen en Praktische aandachtspunten
 * staat hieronder letterlijk over, inclusief de twee sjablonen met richtvragen.
 *
 * Twee dingen zijn hier afgeleid en niet letterlijk overgenomen, omdat de werkinstructie ze niet
 * als lijst geeft maar het contentschema van de begeleide route ze wel vraagt:
 *
 * 1. `uitwerking` volgt uit de "Resultaat"-opsomming van elke stap. Dat is de lijst van wat er
 *    aan het eind van de stap moet liggen, dus is het ook de lijst van wat de gebruiker onderweg
 *    invult. Zo blijft het afrondscherm een eerlijk beeld van de Resultaat-eis.
 * 2. `documentTitel` en `documentSoort` volgen uit de eerste zin van "Resultaat", bijvoorbeeld
 *    "Na deze stap ligt er een analyse van ongeveer twee pagina's ...".
 *
 * Stap 0.2.2 en 0.2.4 krijgen daarnaast een herhaalbaar onderdeel voor de gesprekken, precies
 * zoals implementatiebesluit 3 van de designhandoff voorschrijft. Daarmee worden de richtvragen
 * echte in-app content in plaats van een losse bijlage.
 */

// --- Sjablonen met richtvragen ------------------------------------------------------------

/** Template richtvragen bij stap 0.2.2, letterlijk uit de werkinstructie. */
const RICHTVRAGEN_HERIJKEN: GesprekSjabloon = {
    titel: 'Richtvragen herijking uitgangspunten en spelregels',
    inleiding:
        'Loop de thema’s hieronder langs en leg per thema vast wat deze stakeholder zegt. '
        + 'Noteer rode draden, geen letterlijke citaten: de terugkoppeling gebeurt via het '
        + 'concept-inkoopbeleid, niet een op een op dit gesprek.',
    secties: [
        {
            key: 'introductie',
            titel: 'Introductie',
            vragen: [
                'Licht kort toe waarom we dit gesprek voeren.',
                'De input gebruiken we voor algemene beeldvorming en bouwstenen voor het inkoopbeleid.',
                'We koppelen het interview niet een op een terug maar verwerken de inzichten in een concept dat later gezamenlijk wordt besproken.',
            ],
        },
        {
            key: 'organisatiedoelstellingen',
            titel: 'Organisatiedoelstellingen en opdrachtgeverschap',
            vragen: [
                'Welke organisatiedoelstellingen moeten via inkoop nadrukkelijker worden ondersteund?',
                'Wat betekent professioneel opdrachtgeverschap voor het inkoopbeleid?',
                'Welke principes moeten altijd herkenbaar zijn in de manier waarop de organisatie inkoopt?',
            ],
        },
        {
            key: 'inkoopdoelen',
            titel: 'Inkoopdoelen en uitgangspunten',
            vragen: [
                'Welke inkoopdoelen zijn echt richtinggevend voor de komende beleidsperiode?',
                'Welke ambities moeten wel of juist niet als inkoopdoel worden opgenomen?',
                'Waar moeten keuzes worden gemaakt om doelstapeling te voorkomen?',
            ],
        },
        {
            key: 'spelregels',
            titel: 'Spelregels en uitvoering',
            vragen: [
                'Welke bestaande spelregels werken goed en moeten behouden blijven?',
                'Welke spelregels zorgen in de praktijk voor onduidelijkheid of vertraging?',
                'Wanneer moet afwijken van beleid mogelijk zijn en hoe moet dat worden vastgelegd?',
            ],
        },
        {
            key: 'governance',
            titel: 'Governance en rollen',
            vragen: [
                'Waar moet besluitvorming over inkoop worden belegd?',
                'Welke rol hebben MT, inkoop, contracteigenaren en control?',
                'Welke rol krijgen categoriemanagement, contractmanagement en leveranciersmanagement?',
            ],
        },
        {
            key: 'afsluiting',
            titel: 'Afsluiting',
            vragen: [
                'Zijn er onderwerpen die we niet hebben besproken, maar die belangrijk zijn voor het inkoopbeleid?',
                'Zijn er documenten, voorbeelden of personen die nog meegenomen moeten worden?',
                'Zijn er aandachtspunten voor het opstellen of bespreken van het conceptbeleid?',
                'Is duidelijk hoe de terugkoppeling in algemene zin plaatsvindt via het concept-inkoopbeleid?',
            ],
        },
    ],
}

/** Template richtvragen gesprek bij stap 0.2.4, letterlijk uit de werkinstructie. */
const RICHTVRAGEN_BESPREKEN: GesprekSjabloon = {
    titel: 'Richtvragen gesprek over het concept-inkoopbeleid',
    inleiding:
        'Bespreek niet alleen wat er in het beleid staat, maar vooral wat het betekent voor '
        + 'dagelijks handelen. Gebruik dit gesprek om inhoud scherp te krijgen en weerstand vroeg '
        + 'te herkennen.',
    secties: [
        {
            key: 'herkenbaarheid',
            titel: 'Herkenbaarheid',
            vragen: [
                'Herkent u de uitgangspunten en inkoopdoelen in dit conceptbeleid?',
                'Sluit het beleid aan bij hoe de organisatie wil inkopen en opdrachtgeven?',
                'Welke onderdelen zijn nog onvoldoende duidelijk of herkenbaar?',
            ],
        },
        {
            key: 'uitvoerbaarheid',
            titel: 'Uitvoerbaarheid',
            vragen: [
                'Zijn de voorgestelde spelregels werkbaar in de praktijk?',
                'Zijn rollen en verantwoordelijkheden voldoende duidelijk?',
                'Waar verwacht u knelpunten bij toepassing van het beleid?',
            ],
        },
        {
            key: 'governance',
            titel: 'Governance en rollen',
            vragen: [
                'Is duidelijk waar besluitvorming over inkoop wordt belegd?',
                'Is duidelijk wanneer en hoe van beleid mag worden afgeweken?',
                'Zijn de rollen van MT, inkoop, contracteigenaren en control voldoende scherp?',
            ],
        },
        {
            key: 'toepassing',
            titel: 'Toepassing',
            vragen: [
                'Kunt u dit beleid straks uitleggen aan collega’s?',
                'Wat is nodig om het beleid goed te laten landen in de organisatie?',
                'Welke onderdelen vragen nog bespreking voordat het beleid wordt vastgesteld?',
            ],
        },
    ],
}

// --- Hulpmiddelen elders in de app --------------------------------------------------------

const HULPMIDDEL_DOCUMENTEN: Hulpmiddel = {
    label: 'Documenten',
    beschrijving: 'Upload het huidige beleid, de visie en de andere bronnen, en doorzoek ze.',
    to: '/dashboard/inkoopbeleid/documenten',
    icon: 'i-lucide-file-text',
}

const HULPMIDDEL_ADVISEUR: Hulpmiddel = {
    label: 'Digitale adviseur',
    beschrijving: 'Stel een vraag en krijg antwoord uit de documenten van deze organisatie.',
    to: '/dashboard/inkoopbeleid/adviseur',
    icon: 'i-lucide-message-circle-question',
}

const HULPMIDDEL_HOOFDSTUKKEN: Hulpmiddel = {
    label: 'Hoofdstukken van het beleid',
    beschrijving: 'De tien hoofdstukken van het inkoopbeleid schrijven of laten voorstellen.',
    to: '/dashboard/inkoopbeleid/:id',
    icon: 'i-lucide-book-open',
}

const HULPMIDDEL_TOETS: Hulpmiddel = {
    label: 'Toets een inkoop',
    beschrijving: 'Welke procedure en welke handtekening horen bij dit bedrag?',
    to: '/dashboard/inkoopbeleid/toets',
    icon: 'i-lucide-calculator',
}

const HULPMIDDEL_AFWIJKINGEN: Hulpmiddel = {
    label: 'Pas toe of leg uit',
    beschrijving: 'Leg vast waarom er van de regels is afgeweken.',
    to: '/dashboard/inkoopbeleid/afwijkingen',
    icon: 'i-lucide-triangle-alert',
}

// --- De bouwsteen -------------------------------------------------------------------------

/** Iedere stap heeft dezelfde doelgroep; de werkinstructies herhalen deze zin letterlijk. */
const DOELGROEP = 'Medior adviseur van Adjust of medewerker bij de klant op vergelijkbaar niveau.'

export const BOUWSTEEN_INKOOPBELEID: Bouwsteen = {
    number: '0.2',
    title: 'Inkoopbeleid',
    roomTitle: 'Fundament',
    niveau: 'Medior',
    introductie: [
        'In deze bouwsteen stel je samen met de organisatie het inkoopbeleid op: welke '
        + 'uitgangspunten, inkoopdoelen en spelregels gelden er, hoe draagt inkoop bij aan de '
        + 'organisatiedoelstellingen, en hoe ziet professioneel opdrachtgeverschap eruit?',
        'Je wordt stap voor stap door het proces geleid, van de analyse van het bestaande beleid '
        + 'tot een formeel vastgesteld inkoopbeleid. Per stap zie je precies wat je nodig hebt, '
        + 'wat je doet en welk document je oplevert.',
    ],
    eindresultaat: 'een vastgesteld inkoopbeleid, inclusief communicatie- en implementatieafspraak',
    hulpmiddelen: [
        HULPMIDDEL_DOCUMENTEN,
        HULPMIDDEL_ADVISEUR,
        HULPMIDDEL_HOOFDSTUKKEN,
        HULPMIDDEL_TOETS,
        HULPMIDDEL_AFWIJKINGEN,
    ],
    stappen: [
        // --- 0.2.1 ------------------------------------------------------------------------
        {
            id: 'analyse',
            number: '0.2.1',
            title: 'Analyse bestaand beleid en kaders',
            status: 'analyse',
            doelgroep: DOELGROEP,
            kern: 'Begrijpen welke beleidskaders, uitgangspunten, procedures en governance-afspraken relevant zijn voor het nieuwe inkoopbeleid.',
            vervolg: 'Input voor 0.2.2 Herijken uitgangspunten en spelregels.',
            doel: [
                'In deze stap krijgt de adviseur inzicht in het bestaande inkoopbeleid, de geldende kaders en de manier waarop inkoop nu is georganiseerd.',
                'De analyse maakt duidelijk welke documenten, uitgangspunten, procedures en governance-afspraken relevant zijn voor het nieuwe of herijkte inkoopbeleid. De analyse start bij de organisatiedoelstellingen en opdrachtgeverschap, niet bij de inkoopprocedure.',
                'De opbrengst vormt de basis voor stap 0.2.2 Herijken uitgangspunten en spelregels, waarin keuzes worden gemaakt over wat behouden, aangepast of toegevoegd wordt.',
            ],
            benodigdeInput: [
                'Ondernemingsplan / strategisch plan.',
                'Huidig inkoopbeleid of aanbestedingsbeleid.',
                'Visie op opdrachtgeverschap, als deze al is opgesteld (vanuit bouwsteen 0.1).',
                'Uitkomst van stap 0.1.1 Documentstudie, als deze beschikbaar is.',
                'Procuratieregeling en mandateringsregeling.',
                'Integriteitscode en relevante governancekaders.',
                'Algemene inkoopvoorwaarden en standaard contractvoorwaarden.',
                'Procesbeschrijvingen voor inkopen, aanbesteden en contracteren.',
                'Spendanalyse, contractregister en inkoopkalender, indien beschikbaar.',
                'Audit-, control- of compliancebevindingen over inkoop, contractmanagement of dossiervorming.',
            ],
            aanpak: [
                'Lees de belangrijkste strategie- en beleidsdocumenten en bepaal welke organisatiedoelstellingen richtinggevend zijn voor inkoop.',
                'Breng het bestaande inkoopbeleid, aanbestedingsbeleid en de bijbehorende spelregels op hoofdlijnen in kaart.',
                'Inventariseer welke kaders gelden voor besluitvorming, mandatering, procuratie, integriteit, governance en contractvorming.',
                'Toets of en hoe professioneel opdrachtgeverschap zichtbaar terugkomt in bestaand beleid en bestaande werkwijzen.',
                'Breng in kaart welke onderdelen van het toekomstige inkoopbeleid al voldoende aanwezig zijn.',
                'Noteer observaties over ontbrekende, verouderde, overlappende of onduidelijke onderdelen.',
                'Formuleer onderwerpen die in stap 0.2.2 herijkt of expliciet besproken moeten worden.',
                'Leg de analyse compact vast, zonder alvast inhoudelijke keuzes of beleidswijzigingen te bepalen.',
            ],
            resultaatIntro: 'Na deze stap ligt er een analyse van ongeveer twee pagina’s met:',
            resultaat: [
                'een overzicht van relevante documenten en kaders;',
                'een korte beschrijving van de huidige inrichting van inkoopbeleid en spelregels;',
                'een overzicht van relevante governance-, procuratie- en mandateringsafspraken;',
                'een eerste beeld van de relatie tussen strategie, opdrachtgeverschap en inkoop;',
                'observaties over onderdelen die behouden, verduidelijkt of herijkt moeten worden;',
                'aandachtspunten voor stap 0.2.2 Herijken uitgangspunten en spelregels.',
            ],
            templatesTekst: 'Geen vast template voor de aanpak.',
            kwaliteitscriteria: [
                'de relevante beleidsdocumenten en kaders in een overzicht zijn opgenomen;',
                'de organisatiedoelstellingen die richting geven aan inkoop expliciet zijn beschreven;',
                'de relatie tussen opdrachtgeverschap en bestaand inkoopbeleid zichtbaar is gemaakt;',
                'de huidige spelregels, procedures en besluitvorming op hoofdlijnen zijn beschreven;',
                'de belangrijkste observaties over ontbrekende, verouderde of onduidelijke onderdelen zijn vastgelegd;',
                'de herijkingsonderwerpen voor stap 0.2.2 concreet zijn benoemd;',
                'de analyse compact genoeg is om als input voor een werksessie of bespreking te gebruiken.',
            ],
            controlevragen: [
                'Begrijp ik welke organisatiedoelstellingen richtinggevend zijn voor het inkoopbeleid?',
                'Heb ik voldoende zicht op het bestaande beleid, de procedures en de kaders?',
                'Weet ik hoe opdrachtgeverschap nu wel of niet terugkomt in het inkoopbeleid?',
                'Heb ik observaties vastgelegd zonder al keuzes te maken?',
                'Heb ik voldoende input om stap 0.2.2 gericht voor te bereiden?',
            ],
            aandachtspunten: [
                'Start niet met drempelbedragen en procedures, maar met organisatiedoelstellingen en opdrachtgeverschap.',
                'Maak geen beleidskeuzes in deze stap; noteer alleen observaties en herijkingsonderwerpen.',
                'Voorkom een te brede documentstudie; focus op documenten die richting geven aan beleid, spelregels en governance.',
                'Let op inconsistenties tussen beleid, mandatering, procuratie en dagelijkse praktijk.',
                'Laat bestaande procedures niet automatisch leidend zijn voor nieuw beleid; onderzoek eerst waarom ze ooit zijn ingevoerd.',
            ],
            documentTitel: 'Analyse bestaand beleid en kaders',
            documentSoort: 'Analyse',
            uitwerking: [
                {
                    id: 'documenten-en-kaders',
                    label: 'Overzicht van relevante documenten en kaders',
                    hint: 'Welke documenten geven richting aan beleid, spelregels en governance?',
                    aanpakIndex: 0,
                    tipIndex: 2,
                    hulpmiddel: HULPMIDDEL_DOCUMENTEN,
                },
                {
                    id: 'huidige-inrichting',
                    label: 'Huidige inrichting van inkoopbeleid en spelregels',
                    hint: 'Het bestaande inkoopbeleid en aanbestedingsbeleid op hoofdlijnen.',
                    aanpakIndex: 1,
                    tipIndex: 4,
                    hulpmiddel: HULPMIDDEL_ADVISEUR,
                },
                {
                    id: 'governance-procuratie-mandatering',
                    label: 'Governance-, procuratie- en mandateringsafspraken',
                    hint: 'Welke kaders gelden voor besluitvorming, mandatering, procuratie en integriteit?',
                    aanpakIndex: 2,
                    tipIndex: 3,
                },
                {
                    id: 'strategie-opdrachtgeverschap-inkoop',
                    label: 'Relatie tussen strategie, opdrachtgeverschap en inkoop',
                    hint: 'Komt professioneel opdrachtgeverschap zichtbaar terug in het bestaande beleid?',
                    aanpakIndex: 3,
                    tipIndex: 0,
                },
                {
                    id: 'observaties',
                    label: 'Observaties over behouden, verduidelijken of herijken',
                    hint: 'Ontbrekende, verouderde, overlappende of onduidelijke onderdelen.',
                    aanpakIndex: 5,
                    tipIndex: 1,
                },
                {
                    id: 'herijkingsonderwerpen',
                    label: 'Herijkingsonderwerpen voor stap 0.2.2',
                    hint: 'Dit is de directe input voor de gesprekken in de volgende stap.',
                    aanpakIndex: 6,
                    tipIndex: 1,
                },
            ],
        },

        // --- 0.2.2 ------------------------------------------------------------------------
        {
            id: 'herijken',
            number: '0.2.2',
            title: 'Herijken uitgangspunten en spelregels',
            status: 'herijken',
            doelgroep: DOELGROEP,
            kern: 'Beelden ophalen en toetsen over de gewenste uitgangspunten, inkoopdoelen en spelregels voor het nieuwe inkoopbeleid.',
            vervolg: 'Input voor 0.2.3 Opstellen concept inkoopbeleid.',
            doel: [
                'In deze stap wordt de analyse uit 0.2.1 met de opdrachtgever en relevante stakeholders besproken.',
                'Het doel is om beelden op te halen over de gewenste richting van het inkoopbeleid en te toetsen welke uitgangspunten en spelregels herkenbaar, werkbaar en passend zijn. De gesprekken creeren bewustwording en draagvlak.',
                'Het beleid moet straks richting geven aan professioneel opdrachtgeverschap, samenwerking met opdrachtnemers en realisatie van inkoopdoelen. De opbrengst vormt de basis voor stap 0.2.3 Opstellen concept inkoopbeleid.',
            ],
            benodigdeInput: [
                'Analyse uit 0.2.1 Analyse bestaand beleid en kaders.',
                'Visie op opdrachtgeverschap, als deze beschikbaar is.',
                'Ondernemingsplan / strategisch plan.',
                'Relevante open punten uit bestaand beleid die herijking vragen.',
                'Lijst met te betrekken stakeholders.',
                'Minimaal: directeur/bestuurder, overige MT-leden en concern controller.',
            ],
            aanpak: [
                'Bepaal met de opdrachtgever welke stakeholders betrokken worden.',
                'Bereid per gesprek of werksessie de belangrijkste bespreekpunten voor op basis van 0.2.1.',
                'Licht het doel toe en geef aan hoe de input wordt gebruikt.',
                'Bespreek welke organisatiedoelstellingen via inkoop ondersteund moeten worden.',
                'Toets welke bestaande uitgangspunten en spelregels herkenbaar en werkbaar zijn.',
                'Inventariseer welke onderdelen ontbreken, knellen of tot discussie leiden.',
                'Haal beelden op over inkoopdoelen, opdrachtgeverschap, governance en uitvoering.',
                'Leg rode draden, verschillen in inzicht en open punten vast als input voor 0.2.3.',
            ],
            resultaatIntro: 'Na deze stap ligt er een compacte samenvatting van circa 2 tot 3 pagina’s met:',
            resultaat: [
                'de belangrijkste beelden van stakeholders over inkoop en opdrachtgeverschap;',
                'rode draden over gewenste uitgangspunten en spelregels;',
                'onderdelen die behouden, aangepast of toegevoegd moeten worden;',
                'verschillen in inzicht of onderwerpen die nadere keuze vragen;',
                'eerste bouwstenen voor inkoopdoelen, spelregels en governance;',
                'aandachtspunten voor het concept-inkoopbeleid in stap 0.2.3.',
            ],
            templatesTekst: 'Template: richtvragen voor de gesprekken met stakeholders. Het sjabloon staat in het werkscherm "Gesprekken met stakeholders".',
            kwaliteitscriteria: [
                'de relevante stakeholders zijn gesproken of betrokken in een werksessie;',
                'de belangrijkste beelden over inkoop en opdrachtgeverschap zijn vastgelegd;',
                'duidelijk is welke uitgangspunten herkenbaar en werkbaar zijn;',
                'de belangrijkste knelpunten en discussiepunten zijn benoemd;',
                'eerste bouwstenen voor inkoopdoelen en spelregels zijn geformuleerd;',
                'open keuzes expliciet zijn vastgelegd voor verwerking in 0.2.3;',
                'er voldoende inhoudelijke input is om het concept-inkoopbeleid op te stellen.',
            ],
            controlevragen: [
                'Heb ik de juiste stakeholders betrokken om de uitgangspunten te toetsen?',
                'Begrijp ik welke organisatiedoelstellingen leidend zijn voor het inkoopbeleid?',
                'Weet ik welke spelregels in de praktijk goed werken en welke niet?',
                'Heb ik rode draden vastgelegd zonder uitspraken aan personen te koppelen?',
                'Heb ik voldoende input om het concept-inkoopbeleid op te stellen?',
            ],
            aandachtspunten: [
                'Voorkom dat het gesprek direct naar drempelbedragen en procedures gaat.',
                'Bespreek eerst doelstellingen, opdrachtgeverschap en gewenste werking van beleid.',
                'Maak duidelijk dat dit geen besluitvormende stap is, maar een stap om beelden en richting op te halen.',
                'Leg verschillen in inzicht expliciet vast; werk ze niet te vroeg glad.',
                'Koppel niet een op een terug op gesprekken; verwerk rode draden in het conceptbeleid.',
            ],
            documentTitel: 'Samenvatting herijking uitgangspunten en spelregels',
            documentSoort: 'Samenvatting',
            uitwerking: [
                {
                    id: 'gesprekken',
                    label: 'Gesprekken met stakeholders',
                    hint: 'Voeg per stakeholder een gesprek toe en leg per thema vast wat is opgehaald. Minimaal: directeur/bestuurder, overige MT-leden en concern controller.',
                    aanpakIndex: 1,
                    tipIndex: 0,
                    herhaalbaar: {
                        eenheid: 'Gesprek',
                        titelLabel: 'Naam en rol van de stakeholder',
                        titelPlaceholder: 'Bijvoorbeeld: J. de Vries, concern controller',
                        sjabloon: RICHTVRAGEN_HERIJKEN,
                    },
                },
                {
                    id: 'beelden-stakeholders',
                    label: 'Belangrijkste beelden over inkoop en opdrachtgeverschap',
                    hint: 'Wat zeggen stakeholders over de rol van inkoop en over goed opdrachtgeverschap?',
                    aanpakIndex: 6,
                    tipIndex: 1,
                },
                {
                    id: 'rode-draden',
                    label: 'Rode draden over gewenste uitgangspunten en spelregels',
                    hint: 'Wat komt bij meerdere stakeholders terug?',
                    aanpakIndex: 7,
                    tipIndex: 4,
                },
                {
                    id: 'behouden-aanpassen-toevoegen',
                    label: 'Onderdelen om te behouden, aan te passen of toe te voegen',
                    hint: 'Welke bestaande spelregels werken, en welke knellen?',
                    aanpakIndex: 4,
                    tipIndex: 0,
                },
                {
                    id: 'verschillen-in-inzicht',
                    label: 'Verschillen in inzicht en onderwerpen die een keuze vragen',
                    hint: 'Werk deze niet glad. Ze zijn juist het gespreksmateriaal voor stap 0.2.4.',
                    aanpakIndex: 5,
                    tipIndex: 3,
                },
                {
                    id: 'eerste-bouwstenen',
                    label: 'Eerste bouwstenen voor inkoopdoelen, spelregels en governance',
                    hint: 'De inkoopdoelen kun je meteen als losse doelen vastleggen bij het inkoopbeleid.',
                    aanpakIndex: 6,
                    tipIndex: 1,
                    hulpmiddel: HULPMIDDEL_HOOFDSTUKKEN,
                },
                {
                    id: 'aandachtspunten-concept',
                    label: 'Aandachtspunten voor het concept-inkoopbeleid in stap 0.2.3',
                    hint: 'Dit is de directe input voor de volgende stap.',
                    aanpakIndex: 7,
                    tipIndex: 4,
                },
            ],
        },

        // --- 0.2.3 ------------------------------------------------------------------------
        {
            id: 'opstellen',
            number: '0.2.3',
            title: 'Opstellen concept inkoopbeleid',
            status: 'opstellen',
            doelgroep: DOELGROEP,
            kern: 'Bevindingen uit analyse en gesprekken vertalen naar een samenhangend concept-inkoopbeleid.',
            vervolg: 'Input voor 0.2.4 Bespreken concept inkoopbeleid.',
            doel: [
                'In deze stap vertaalt de adviseur de opbrengsten uit 0.2.1 Analyse bestaand beleid en kaders en 0.2.2 Herijken uitgangspunten en spelregels naar een samenhangend concept-inkoopbeleid.',
                'Het conceptbeleid maakt duidelijk hoe inkoop bijdraagt aan de organisatiedoelstellingen, professioneel opdrachtgeverschap en de gewenste samenwerking met opdrachtnemers. Het beleid beschrijft de uitgangspunten, spelregels, rollen en werkwijze die richting geven aan inkopen, aanbesteden, contracteren en contractmanagement.',
                'De conceptversie vormt de basis voor stap 0.2.4 Bespreken concept inkoopbeleid.',
            ],
            benodigdeInput: [
                'Analyse uit 0.2.1 Analyse bestaand beleid en kaders.',
                'Samenvatting uit 0.2.2 Herijken uitgangspunten en spelregels.',
                'Visie op opdrachtgeverschap, als deze beschikbaar is.',
                'Rode draden uit gesprekken of werksessies met stakeholders.',
                'Herijkte uitgangspunten, inkoopdoelen en spelregels.',
                'Open keuzes en aandachtspunten voor bespreking.',
            ],
            aanpak: [
                'Bepaal de hoofdstructuur van het concept-inkoopbeleid.',
                'Orden de input uit 0.2.1 en 0.2.2 naar thema’s zoals strategie, opdrachtgeverschap, doelen, spelregels, procedures en organisatie.',
                'Formuleer de kernboodschap van het beleid: waarom dit beleid nodig is en waar het richting aan geeft.',
                'Werk de hoofdstukken uit in een logische volgorde, startend bij organisatiedoelstellingen en opdrachtgeverschap.',
                'Vertaal de herijkte uitgangspunten naar concrete spelregels voor inkopen, aanbesteden en contracteren.',
                'Maak zichtbaar wat het beleid betekent voor rollen, besluitvorming, categoriemanagement en contractmanagement.',
                'Toets per onderdeel of de tekst herleidbaar is naar analyse, gesprekken of gemaakte keuzes.',
                'Leg open punten en bespreekpunten vast voor stap 0.2.4.',
            ],
            resultaatIntro: 'Na deze stap ligt er een concept-inkoopbeleid van circa 10 tot 20 pagina’s met:',
            resultaat: [
                'een inleiding, doel en reikwijdte van het beleid;',
                'verbinding met organisatiedoelstellingen en opdrachtgeverschap;',
                'uitgangspunten en inkoopdoelen;',
                'beleidskaders en spelregels voor inkopen;',
                'procedures, drempelbedragen en afwijkingsmogelijkheden;',
                'rollen, verantwoordelijkheden en governance;',
                'werkwijze voor categoriemanagement, contractmanagement en leveranciersmanagement;',
                'open punten en bespreekpunten voor stap 0.2.4.',
            ],
            templatesTekst: 'Geen vast template voor de aanpak.',
            kwaliteitscriteria: [
                'het conceptbeleid start bij organisatiedoelstellingen en opdrachtgeverschap;',
                'de uitgangspunten en spelregels aansluiten op de opbrengst uit 0.2.1 en 0.2.2;',
                'de inkoopdoelen herkenbaar zijn gekoppeld aan organisatiedoelstellingen;',
                'procedures en drempelbedragen logisch voortkomen uit de gekozen spelregels;',
                'rollen, verantwoordelijkheden en besluitvorming op hoofdlijnen duidelijk zijn beschreven;',
                'open punten expliciet zijn gemarkeerd voor bespreking in stap 0.2.4;',
                'het concept concreet genoeg is om met stakeholders en besluitvormers te bespreken.',
            ],
            controlevragen: [
                'Begrijp ik welke organisatiedoelstellingen leidend zijn voor het inkoopbeleid?',
                'Kan ik elk belangrijk onderdeel herleiden naar analyse, gesprekken of gemaakte keuzes?',
                'Geeft het conceptbeleid voldoende richting aan professioneel opdrachtgeverschap?',
                'Zijn uitgangspunten, spelregels en procedures logisch met elkaar verbonden?',
                'Is het concept concreet genoeg om in stap 0.2.4 goed te bespreken?',
            ],
            aandachtspunten: [
                'Schrijf geen procedurehandboek, maar een richtinggevend beleid.',
                'Begin bij doelen en opdrachtgeverschap, niet bij drempelbedragen.',
                'Maak onderscheid tussen uitgangspunten, spelregels en uitvoeringsprocedures.',
                'Voorkom dat alle opgehaalde wensen automatisch in beleid terechtkomen.',
                'Werk open discussiepunten niet te vroeg glad; gebruik ze bewust voor stap 0.2.4.',
            ],
            documentTitel: 'Concept-inkoopbeleid',
            documentSoort: 'Concept',
            uitwerking: [
                {
                    id: 'inleiding-doel-reikwijdte',
                    label: 'Inleiding, doel en reikwijdte van het beleid',
                    hint: 'De kernboodschap: waarom is dit beleid nodig en waar geeft het richting aan? Hoort bij hoofdstuk 1 Toepassing.',
                    aanpakIndex: 2,
                    tipIndex: 0,
                    hulpmiddel: HULPMIDDEL_HOOFDSTUKKEN,
                },
                {
                    id: 'organisatiedoelstellingen-opdrachtgeverschap',
                    label: 'Verbinding met organisatiedoelstellingen en opdrachtgeverschap',
                    hint: 'Hoort bij hoofdstuk 2 Opdrachtgeverschap. Begin hier, niet bij de procedures.',
                    aanpakIndex: 3,
                    tipIndex: 1,
                    hulpmiddel: HULPMIDDEL_HOOFDSTUKKEN,
                },
                {
                    id: 'uitgangspunten-inkoopdoelen',
                    label: 'Uitgangspunten en inkoopdoelen',
                    hint: 'Hoort bij hoofdstuk 3 Inkoopdoelen. Leg de doelen ook als losse doelen vast bij het beleid.',
                    aanpakIndex: 4,
                    tipIndex: 3,
                    hulpmiddel: HULPMIDDEL_HOOFDSTUKKEN,
                },
                {
                    id: 'beleidskaders-spelregels',
                    label: 'Beleidskaders en spelregels voor inkopen',
                    hint: 'Hoort bij hoofdstuk 4 Inkoopbeleidskaders en spelregels.',
                    aanpakIndex: 4,
                    tipIndex: 2,
                    hulpmiddel: HULPMIDDEL_HOOFDSTUKKEN,
                },
                {
                    id: 'procedures-drempelbedragen',
                    label: 'Procedures, drempelbedragen en afwijkingsmogelijkheden',
                    hint: 'Hoort bij hoofdstuk 6. De drempelbedragen zelf staan als gegevens in de app; toets ze hier.',
                    aanpakIndex: 4,
                    tipIndex: 1,
                    hulpmiddel: HULPMIDDEL_TOETS,
                },
                {
                    id: 'rollen-governance',
                    label: 'Rollen, verantwoordelijkheden en governance',
                    hint: 'Hoort bij hoofdstuk 7 Inkooporganisatie.',
                    aanpakIndex: 5,
                    tipIndex: 2,
                    hulpmiddel: HULPMIDDEL_HOOFDSTUKKEN,
                },
                {
                    id: 'categorie-contract-leveranciersmanagement',
                    label: 'Categoriemanagement, contractmanagement en leveranciersmanagement',
                    hint: 'Hoort bij hoofdstuk 5 Categoriemanagement.',
                    aanpakIndex: 5,
                    tipIndex: 0,
                    hulpmiddel: HULPMIDDEL_HOOFDSTUKKEN,
                },
                {
                    id: 'open-punten',
                    label: 'Open punten en bespreekpunten voor stap 0.2.4',
                    hint: 'Markeer hier bewust wat nog niet is dichtgetimmerd. Dit is de agenda voor de volgende stap.',
                    aanpakIndex: 7,
                    tipIndex: 4,
                },
            ],
        },

        // --- 0.2.4 ------------------------------------------------------------------------
        {
            id: 'bespreken',
            number: '0.2.4',
            title: 'Bespreken concept inkoopbeleid',
            status: 'bespreken',
            doelgroep: DOELGROEP,
            kern: 'Concept-inkoopbeleid toetsen, aanscherpen en voorzien van voldoende draagvlak.',
            vervolg: 'Input voor 0.2.5 Vaststellen inkoopbeleid.',
            doel: [
                'In deze stap bespreekt de adviseur het concept-inkoopbeleid met relevante stakeholders en besluitvormers.',
                'Het doel is om te toetsen of het beleid herkenbaar, uitvoerbaar en richtinggevend is voor de organisatie. De bespreking gaat niet alleen over tekst, maar vooral over wat het beleid betekent voor dagelijks handelen, opdrachtgeverschap en samenwerking met opdrachtnemers.',
                'De opbrengst vormt de basis voor stap 0.2.5 Vaststellen inkoopbeleid.',
            ],
            benodigdeInput: [
                'Concept-inkoopbeleid uit 0.2.3 Opstellen concept inkoopbeleid.',
                'Open punten en bespreekpunten uit 0.2.3.',
                'Samenvatting van rode draden uit 0.2.2 Herijken uitgangspunten en spelregels.',
                'Stakeholderlijst met relevante betrokkenen en besluitvormers.',
                'Inschatting van de adviseur welke onderdelen bij welke stakeholders getoetst moeten worden.',
                'Minimaal: opdrachtgever en relevante MT-leden of besluitvormers die nodig zijn om het conceptbeleid inhoudelijk te toetsen.',
            ],
            aanpak: [
                'Bepaal welke onderdelen van het conceptbeleid met welke stakeholders besproken moeten worden.',
                'Bespreek relevante onderdelen individueel of in kleine groep met stakeholders.',
                'Toets of uitgangspunten, inkoopdoelen en spelregels herkenbaar en uitvoerbaar zijn.',
                'Inventariseer tekstuele opmerkingen, inhoudelijke aandachtspunten en open keuzes.',
                'Verwerk feedback tot een aangescherpte versie van het conceptbeleid.',
                'Bereid een plenaire bespreking voor met MT of betrokken besluitvormers.',
                'Bespreek plenair de belangrijkste keuzes, aandachtspunten en betekenis voor de praktijk.',
                'Leg vast welke aandachtspunten meegaan naar stap 0.2.5.',
            ],
            resultaatIntro: 'Na deze stap ligt er een aangescherpt concept-inkoopbeleid met:',
            resultaat: [
                'verwerkte feedback van stakeholders;',
                'een overzicht van open aandachtspunten;',
                'inzicht in draagvlak voor de belangrijkste uitgangspunten en spelregels;',
                'duidelijkheid over onderdelen die nog toelichting of aanscherping vragen;',
                'aandachtspunten voor vaststelling in stap 0.2.5;',
                'indien nodig: een voorstel voor een tweede bespreking.',
            ],
            templatesTekst: 'Richtvragen voor gesprek. Het sjabloon staat in het werkscherm "Individuele gesprekken en kleine groepen".',
            kwaliteitscriteria: [
                'het conceptbeleid is besproken met relevante stakeholders en besluitvormers;',
                'feedback is verwerkt of bewust als aandachtspunt is vastgelegd;',
                'de belangrijkste uitgangspunten en spelregels herkenbaar zijn voor betrokkenen;',
                'duidelijk is of het beleid uitvoerbaar is in de praktijk;',
                'rollen, verantwoordelijkheden en besluitvorming voldoende begrijpelijk zijn beschreven;',
                'open aandachtspunten zijn benoemd voor vaststelling of vervolgbespreking;',
                'het conceptbeleid voldoende draagvlak heeft om naar stap 0.2.5 te gaan.',
            ],
            controlevragen: [
                'Heb ik de juiste stakeholders betrokken bij de bespreking van het conceptbeleid?',
                'Begrijp ik welke onderdelen nog aandacht of aanscherping vragen?',
                'Is duidelijk of het beleid herkenbaar en uitvoerbaar is?',
                'Zijn opmerkingen verwerkt of bewust als open aandachtspunt vastgelegd?',
                'Heb ik voldoende basis om door te gaan naar vaststelling?',
            ],
            aandachtspunten: [
                'Bespreek niet alleen wat er in het beleid staat, maar ook wat dit betekent voor dagelijks handelen.',
                'Richt de discussie op keuzes en uitgangspunten; detailuitwerkingen kunnen later worden uitgewerkt.',
                'Voorkom dat de bespreking verzandt in details over drempelbedragen.',
                'Gebruik individuele gesprekken om inhoud scherp te krijgen en weerstand vroeg te herkennen.',
                'Plan een tweede sessie als het gesprek vooral nieuwe discussie oplevert in plaats van afronding.',
            ],
            documentTitel: 'Aangescherpt concept-inkoopbeleid',
            documentSoort: 'Concept',
            uitwerking: [
                {
                    id: 'individuele-gesprekken',
                    label: 'Individuele gesprekken en kleine groepen',
                    hint: 'Deze gesprekken komen eerst, voor de plenaire bespreking. Voeg per stakeholder een gesprek toe.',
                    aanpakIndex: 1,
                    tipIndex: 3,
                    herhaalbaar: {
                        eenheid: 'Gesprek',
                        titelLabel: 'Naam en rol van de stakeholder',
                        titelPlaceholder: 'Bijvoorbeeld: A. Jansen, manager vastgoed',
                        sjabloon: RICHTVRAGEN_BESPREKEN,
                    },
                },
                {
                    id: 'verwerkte-feedback',
                    label: 'Verwerkte feedback van stakeholders',
                    hint: 'Wat is aangepast in het concept naar aanleiding van de gesprekken?',
                    aanpakIndex: 4,
                    tipIndex: 1,
                    hulpmiddel: HULPMIDDEL_HOOFDSTUKKEN,
                },
                {
                    id: 'plenaire-bespreking',
                    label: 'Plenaire bespreking met MT of besluitvormers',
                    hint: 'Pas na de individuele ronde. Bespreek de belangrijkste keuzes en wat ze betekenen voor de praktijk.',
                    aanpakIndex: 6,
                    tipIndex: 0,
                },
                {
                    id: 'open-aandachtspunten',
                    label: 'Overzicht van open aandachtspunten',
                    hint: 'Wat is bewust blijven staan?',
                    aanpakIndex: 3,
                    tipIndex: 2,
                },
                {
                    id: 'draagvlak',
                    label: 'Draagvlak voor de belangrijkste uitgangspunten en spelregels',
                    hint: 'Waar is men het over eens, en waar nog niet?',
                    aanpakIndex: 2,
                    tipIndex: 0,
                },
                {
                    id: 'toelichting-aanscherping',
                    label: 'Onderdelen die nog toelichting of aanscherping vragen',
                    hint: '',
                    aanpakIndex: 3,
                    tipIndex: 1,
                },
                {
                    id: 'aandachtspunten-vaststelling',
                    label: 'Aandachtspunten voor de vaststelling in stap 0.2.5',
                    hint: 'Dit is de directe input voor de laatste stap.',
                    aanpakIndex: 7,
                    tipIndex: 2,
                },
                {
                    id: 'tweede-bespreking',
                    label: 'Voorstel voor een tweede bespreking, indien nodig',
                    hint: 'Alleen invullen als het gesprek vooral nieuwe discussie opleverde in plaats van afronding.',
                    aanpakIndex: 6,
                    tipIndex: 4,
                },
            ],
        },

        // --- 0.2.5 ------------------------------------------------------------------------
        {
            id: 'vaststellen',
            number: '0.2.5',
            title: 'Vaststellen inkoopbeleid',
            status: 'vastgesteld',
            doelgroep: DOELGROEP,
            kern: 'Inkoopbeleid formeel laten vaststellen, communiceren, implementeren en archiveren.',
            vervolg: 'Toepassing van het beleid in inkooptrajecten, contractmanagement en sturing op de uitvoering.',
            doel: [
                'In deze stap wordt het aangescherpte inkoopbeleid formeel vastgesteld volgens het besluitvormingsproces van de organisatie.',
                'De adviseur zorgt dat duidelijk is wie het beleid vaststelt, welke toelichting nodig is en welke aandachtspunten nog meegegeven worden. Ook wordt bepaald hoe het beleid wordt gecommuniceerd, geimplementeerd en geborgd in de dagelijkse inkooppraktijk.',
                'Na deze stap is het inkoopbeleid beschikbaar als vastgesteld kader voor inkopen, aanbesteden, contracteren en contractmanagement.',
            ],
            benodigdeInput: [
                'Aangescherpt concept-inkoopbeleid uit 0.2.4 Bespreken concept inkoopbeleid.',
                'Open aandachtspunten uit 0.2.4.',
                'Besluitvormingsproces van de betreffende organisatie.',
                'Afspraak met opdrachtgever over vaststellingsroute en besluitvormend gremium.',
                'Eventuele oplegnotitie of beslisnotitie voor MT, bestuur of ander gremium.',
                'Input voor communicatie, implementatie en archivering.',
            ],
            aanpak: [
                'Bepaal met de opdrachtgever welke vaststellingsroute geldt.',
                'Maak het inkoopbeleid definitief en verwerk de laatste tekstuele en inhoudelijke punten.',
                'Bepaal of een oplegnotitie of beslisnotitie nodig is en welke beslispunten daarin staan.',
                'Stem af of MT, bestuurder, RvC of een ander gremium moet vaststellen of geinformeerd moet worden.',
                'Bereid de vaststelling voor met een korte toelichting op doel, wijzigingen en aandachtspunten.',
                'Leg vast hoe het beleid wordt gecommuniceerd naar medewerkers die inkopen of contracten beheren.',
                'Bepaal hoe het beleid wordt geimplementeerd in werkwijze, templates, processen en overlegstructuren.',
                'Archiveer de vastgestelde versie op de afgesproken locatie en leg eigenaar, evaluatiemoment en versie vast.',
            ],
            resultaatIntro: 'Na deze stap ligt er een vastgesteld inkoopbeleid met:',
            resultaat: [
                'een definitieve versie van het inkoopbeleid;',
                'een besluit of vaststelling volgens het organisatieproces;',
                'indien nodig: een oplegnotitie of beslisnotitie;',
                'duidelijkheid over communicatie naar de organisatie;',
                'een compacte implementatieafspraak voor toepassing in de praktijk;',
                'een vastgelegde archieflocatie, documenteigenaar, versie en evaluatiemoment.',
            ],
            templatesTekst: 'Geen vast template voor de aanpak.',
            kwaliteitscriteria: [
                'het inkoopbeleid definitief is gemaakt en vrij is van open tekstuele punten;',
                'de vaststellingsroute aansluit op het besluitvormingsproces van de organisatie;',
                'het besluit of akkoord op het beleid is vastgelegd;',
                'duidelijk is wie eigenaar is van het beleid en wanneer evaluatie plaatsvindt;',
                'communicatie en implementatie op hoofdlijnen zijn afgesproken;',
                'de vastgestelde versie is opgeslagen op de afgesproken locatie;',
                'de organisatie weet vanaf wanneer het beleid van toepassing is.',
            ],
            controlevragen: [
                'Weet ik wie het inkoopbeleid formeel moet vaststellen?',
                'Zijn alle open punten uit 0.2.4 verwerkt of bewust geparkeerd?',
                'Is duidelijk hoe en wanneer het beleid met de organisatie wordt gedeeld?',
                'Is duidelijk wat nodig is om het beleid toe te passen in de praktijk?',
                'Weet ik waar de definitieve versie wordt opgeslagen en wie eigenaar is?',
            ],
            aandachtspunten: [
                'Maak van vaststellen geen tekstuele redactieronde; inhoudelijke discussie hoort in 0.2.4.',
                'Sluit aan bij de bestaande governance van de organisatie en maak de route niet zwaarder dan nodig.',
                'Vergeet implementatie niet: beleid werkt pas als processen, templates en mensen erop aansluiten.',
                'Communiceer niet alleen dat er nieuw beleid is, maar ook wat dit betekent voor dagelijks handelen.',
                'Archiveer de definitieve versie zo dat deze later eenduidig terug te vinden is.',
            ],
            documentTitel: 'Vastgesteld inkoopbeleid',
            documentSoort: 'Beleid',
            uitwerking: [
                {
                    id: 'vaststellingsroute',
                    label: 'Vaststellingsroute en besluitvormend gremium',
                    hint: 'Wie stelt vast: MT, bestuurder, RvC of een ander gremium? En wie wordt alleen geinformeerd?',
                    aanpakIndex: 0,
                    tipIndex: 1,
                },
                {
                    id: 'definitieve-versie',
                    label: 'Definitieve versie van het inkoopbeleid',
                    hint: 'Welke laatste tekstuele en inhoudelijke punten zijn verwerkt?',
                    aanpakIndex: 1,
                    tipIndex: 0,
                    hulpmiddel: HULPMIDDEL_HOOFDSTUKKEN,
                },
                {
                    id: 'oplegnotitie',
                    label: 'Oplegnotitie of beslisnotitie',
                    hint: 'Alleen als het besluitvormingsproces daarom vraagt. Welke beslispunten staan erin?',
                    aanpakIndex: 2,
                    tipIndex: 1,
                },
                {
                    id: 'communicatie',
                    label: 'Communicatie naar de organisatie',
                    hint: 'Niet alleen dat er nieuw beleid is, maar ook wat het betekent voor dagelijks handelen.',
                    aanpakIndex: 5,
                    tipIndex: 3,
                },
                {
                    id: 'implementatie',
                    label: 'Implementatieafspraak voor toepassing in de praktijk',
                    hint: 'Werkwijze, templates, processen en overlegstructuren. Beleid werkt pas als die aansluiten.',
                    aanpakIndex: 6,
                    tipIndex: 2,
                    hulpmiddel: HULPMIDDEL_AFWIJKINGEN,
                },
                {
                    id: 'archief-eigenaar-evaluatie',
                    label: 'Archieflocatie, documenteigenaar, versie en evaluatiemoment',
                    hint: 'Leg vast waar de definitieve versie staat, wie eigenaar is en wanneer evaluatie plaatsvindt.',
                    aanpakIndex: 7,
                    tipIndex: 4,
                },
            ],
        },
    ],
}
