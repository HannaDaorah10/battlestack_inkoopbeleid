# AI-evaluatie: configuraties testen zoals een batch-job

Deze map draait veel AI-configuraties achter elkaar tegen dezelfde vragen en documenten, en levert
de uitkomst op in vormen die je kunt lezen, vergelijken en doorsturen. **De harness meet en
presenteert; hij oordeelt niet.** Wat "goed" is bepaal jij, samen met je collega's.

De harness gebruikt geen database en geen Docker. Je hebt alleen een AI-sleutel nodig.

---

## In het kort

```bash
# eenmalig
cp tools/eval/config/sweep.example.json tools/eval/config/sweep.json
# zet je PDF's in tools/eval/corpus/<organisatie>/ en pas sweep.json aan

pnpm eval:models                          # welke modellen heeft je gateway?
pnpm eval:retrieval -- --dry-run          # hoeveel werk wordt dit?
pnpm eval:retrieval                       # fase 1: welk zoekprofiel vindt de juiste passage?
pnpm eval:generate -- --retrieval r_ab12cd34   # fase 2: welk model/prompt antwoordt het best?
pnpm eval:aggregate                       # beoordelingen van collega's -> ranglijst
```

---

## Waarom twee fasen

De AI-keten heeft twee schakels die je los kunt afstellen:

| Fase | Wat je varieert | Hoe je beoordeelt | Kosten |
|---|---|---|---|
| 1. Retrieval | embeddingmodel, chunkgrootte, overlap, topK | objectief: staat het juiste bedrag in een opgehaald fragment? | alleen embeddings |
| 2. Generatie | model, temperature, topP, maxOutputTokens, system prompt | jouw oordeel + objectieve signalen | een aanroep per cel |

Tegelijk sweepen vermenigvuldigt ze. Met 24 retrieval-configuraties, 30 generatie-configuraties en
30 vragen is dat 21.600 aanroepen. Na elkaar: fase 1 kost nul chat-aanroepen en fase 2 kost er 900.

Belangrijker dan de kosten: **fase 1 bepaalt het plafond van fase 2.** Wordt de passage met het
antwoord nooit opgehaald, dan kan geen enkel model hem gebruiken — het kan alleen overtuigend
gokken. Zet retrieval dus eerst vast.

---

## Modellen op deze gateway

Drie dingen die je een mislukte run besparen. Alledrie zijn gemeten tegen sluis.ai, niet uit een
handleiding overgenomen.

**Geen `openai/...`-modellen.** Deze tenant heeft een EU-residentiebeleid. Een OpenAI-model wordt
geweigerd met:

```
provider `openai` (jurisdiction `US`) is not permitted by the tenant's residency policy
```

Beschikbaar zijn: `bedrock/`, `mistral/`, `nebius/`, `scaleway/`, `vertex/` en `sluis/`. Draai
`pnpm eval:models` voor de lijst van jouw tenant — die verandert.

**Anthropic weigert `temperature` en `top_p` samen**, met een kale `Bad Request` die niet zegt wat
er mis is. Eén van de twee werkt prima. De harness stuurt `topP` daarom niet mee zolang hij op 1
staat (bij 1 doet hij toch niets), zodat de Claude-modellen in een standaardsweep gewoon werken.
Zet je `topP` bewust op iets anders, dan mislukken de Claude-cellen — die verschijnen dan met hun
foutmelding in het rapport, de rest van de run gaat door.

**`pnpm eval:models` toont een model dat de gateway zelf niet kan aanroepen.**
`vertex/text-multilingual-embedding-002` staat in de modellenlijst, maar een echte aanroep krijgt
terug:

```
Publisher model `projects/<project>/locations/eu/publishers/google/models/text-multilingual-embedding-002`
was not found or your project does not have access to it.
```

De gateway adverteert het model; het GCP-project achter sluis.ai heeft er kennelijk geen toegang
toe in `locations/eu`. Dat is bij sluis.ai op te lossen, niet in deze repo. Laat het model dus uit
je sweep totdat sluis.ai bevestigt dat de toegang klopt.

Een embeddingmodel dat zo faalt, laat de rest van de sweep intact: fase 1 schrijft voor elke
configuratie met dat model een foutregel (zichtbaar als `fouten` in `samenvatting.md` en
`resultaten.csv`) en gaat door met de configuraties die wel werken — net als fase 2 met een
mislukte Claude-cel doet.

Embeddingmodellen geven vectoren van verschillende lengte. Gemeten:

| Model | Dimensies |
|---|---|
| `bedrock/eu.cohere.embed-v4:0` | 1536 |
| `vertex/text-multilingual-embedding-002` | 768 (in de lijst, maar zie hierboven — momenteel niet bruikbaar) |
| `nebius/Qwen/Qwen3-Embedding-8B` | 4096 |

Voor de harness maakt dat niets uit — elke configuratie krijgt zijn eigen index. Voor de **app**
wel: `NUXT_RAG_EMBEDDING_DIMENSIONS` moet exact gelijk zijn aan wat het gekozen model teruggeeft,
en die waarde ligt vast zodra de pgvector-index is aangemaakt. Nu staat hij op 1536, wat overeenkomt
met cohere embed-v4. Kies je iets anders, dan moet je `DROP TABLE rag_vectors;` doen en opnieuw
indexeren.

---

## Stap voor stap

### 1. Documenten klaarzetten

Zet de beleidsdocumenten in `tools/eval/corpus/<organisatie>/`, één map per organisatie, bijvoorbeeld
`tools/eval/corpus/ons-huis/` en `tools/eval/corpus/welbions/`. Die map staat in `.gitignore`, dus
ze komen niet in GitHub terecht. PDF, DOCX, TXT, MD en CSV worden gelezen met dezelfde
extractie-code als de app (`server/utils/inkoopbeleid/extract.ts`).

De bestandsnaam zelf maakt niet uit: `sweep.json` wijst naar de map, niet naar een specifiek
bestand, en de harness leest alles wat er ondersteund in staat. Meerdere bestanden in dezelfde map
tellen als afzonderlijke documenten van diezelfde organisatie.

Een gescande PDF zonder tekstlaag werkt niet — de harness stopt met die melding in plaats van
overal nul te scoren. Die moet eerst door OCR.

### 2. sweep.json invullen

Kopieer `config/sweep.example.json` naar `config/sweep.json`. Het commentaar in dat bestand legt
elk veld uit. Twee dingen om op te letten:

- **`organisatie` per document is niet optioneel.** De app houdt organisaties gescheiden bij het
  zoeken. Zoekt de sweep in beide beleidsstukken tegelijk, dan meet je iets makkelijkers dan wat de
  app doet: het juiste antwoord is dan vaak bereikbaar via het document van de ándere corporatie.
- **Elke waarde is een lijst.** `"temperature": [0, 0.3, 0.7]` levert drie configuraties op. Alle
  lijsten worden met elkaar gecombineerd, precies zoals een array-job op een cluster.

### 3. Vragen aanvullen

`cases/vragen.jsonl`, één vraag per regel:

```json
{"id": "q01", "vraag": "Hoeveel offertes bij EUR 30.000 diensten?", "organisatie": "ons-huis",
 "verwachteTrefwoorden": ["25.000", "50.000"], "tags": ["drempel"]}
```

`verwachteTrefwoorden` is wat er in het **opgehaalde fragment** moet staan, niet wat in het antwoord
moet staan. Neem daarom de grensbedragen van de juiste drempelregel, niet het antwoord zelf.

Vermijd losse kleine getallen als trefwoord: `"2"` komt in vrijwel elk fragment voor. Bedragen en
procedurenamen (`"meervoudig onderhands"`, `"categoriemanagement"`) zijn veel bruikbaarder.

Vragen zonder trefwoorden tellen niet mee in de score van fase 1, maar verschijnen wél in het
beoordelingsrapport van fase 2. Gebruik dat bewust: de startset bevat twee **controlevragen** waar
het beleid niets over zegt. Een goed antwoord daarop is "dat staat niet in de documenten" — daarmee
zie je welke configuratie eerlijk is en welke iets verzint.

De meegeleverde trefwoorden komen uit `server/database/seeds/005-inkoopbeleid.ts`, dat de echte
drempelbedragen en mandaten van Ons Huis bevat. Controleer ze wel tegen jouw PDF: staat een bedrag
daar anders geschreven, dan telt een vraag onterecht als gemist.

### 4. Fase 1 draaien

```bash
pnpm eval:retrieval -- --dry-run   # toont het aantal configuraties, roept niets aan
pnpm eval:retrieval
```

Levert in `runs/<naam>/retrieval/`:

- `samenvatting.md` — ranglijst met uitleg van elke kolom, winnaar bovenaan
- `resultaten.csv` — één regel per configuratie
- `runs.jsonl` — welke fragmenten per vraag zijn opgehaald, met scores

Kijk of het verschil tussen nummer 1 en 2 groot genoeg is om iets te betekenen. Bij zestien vragen
scheelt één vraag al ruim zes procent — dat is ruis, geen resultaat.

Faalt een embeddingmodel (verkeerde naam, geen toegang, tenant-probleem), dan krijgen alleen de
configuraties die dat model gebruiken een `fouten`-telling en verschijnen ze onderaan de ranglijst;
de rest van de run gaat gewoon door. Een `fouten`-configuratie heeft altijd recall@k 0 — dat
betekent hier "nooit gemeten", niet "niets gevonden". Zie `runs.jsonl` voor de foutmelding zelf.

### 5. Fase 2 draaien

```bash
pnpm eval:generate -- --retrieval r_ab12cd34 --dry-run
pnpm eval:generate -- --retrieval r_ab12cd34
```

Zonder `--retrieval` pakt hij de winnaar van fase 1 en zegt dat hij dat doet.

Levert in `runs/<naam>/generatie/<retrievalConfigId>/` — elke retrieval-configuratie krijgt zijn
eigen submap, dus `pnpm eval:generate -- --retrieval r_A` en daarna `--retrieval r_B` op dezelfde
sweep botsen niet: het is niet één gedeeld `runs.jsonl`, dus de tweede aanroep denkt niet dat alles
al gedaan is en de rapporten van de een overschrijven nooit die van de ander:

| Bestand | Voor wie |
|---|---|
| `beoordeling.html` | je collega's — dit is wat je doorstuurt |
| `sleutel.csv` / `sleutel.json` | alleen jij: welke letter is welke configuratie |
| `samenvatting.md` | jij: objectieve signalen, tokens, duur per configuratie |
| `resultaten.csv` | jij: één regel per antwoord, voor Excel |
| `runs.jsonl` | jij: ruwe antwoorden |

Wil je meerdere retrieval-configuraties naast elkaar door fase 2 halen om te zien of de winnaar van
fase 1 ook echt de beste antwoorden geeft? Draai `eval:generate` gewoon opnieuw met een ander
`--retrieval r_...` — dat schrijft in zijn eigen submap, niets van de vorige run raakt kwijt.

### 6. Laten beoordelen

Stuur `beoordeling.html` naar je collega's. Het is één bestand, werkt offline, vraagt geen inlog en
verstuurt niets. Voorbeeldtekst voor de mail:

> Hoi,
>
> In de bijlage staan een aantal vragen over ons inkoopbeleid, met steeds meerdere antwoorden van
> een AI-adviseur die we aan het uitproberen zijn. Welke instelling welk antwoord gaf staat er
> expres niet bij — het gaat om het antwoord, niet om de naam van het model.
>
> Open het bestand in je browser en geef per antwoord aan of het goed, twijfelachtig of fout is.
> Vooral de bedragen en het aantal offertes zijn belangrijk. Twijfel je, zet er dan kort bij waarom
> — die toelichting is vaak waardevoller dan het oordeel zelf.
>
> Je hoeft het niet in één keer af te maken; je antwoorden blijven bewaard in je browser. Klik aan
> het eind op "Download mijn beoordeling" en stuur me dat bestandje terug.

De pagina print netjes: Ctrl+P geeft een PDF met één vraag per pagina.

### 7. Beoordelingen samenvoegen

Zet de teruggestuurde CSV's in `runs/<naam>/generatie/<retrievalConfigId>/beoordelingen/` en draai:

```bash
pnpm eval:aggregate
pnpm eval:aggregate -- --retrieval r_ab12cd34   # voor een andere run dan de fase-1-winnaar
```

Zonder `--retrieval` pakt hij, net als `eval:generate`, de winnaar van fase 1 — dezelfde
configuratie dus, tenzij je bewust een andere hebt gedraaid.

Levert `ranglijst.csv` en `ranglijst.md`: per configuratie het percentage goed en fout, met de
modelnaam er eindelijk bij. Plus een lijst met de antwoorden waarover beoordelaars het **oneens**
waren — vaak het interessantste deel van het rapport.

---

## Kosten en veiligheid

- `--dry-run` vouwt het raster uit en telt de aanroepen zonder er één te doen. Doe dit altijd eerst.
- `--limit 3` gebruikt alleen de eerste drie vragen, voor een rooktest.
- `maxCalls` in `sweep.json` is een harde bovengrens; de run stopt daar en meldt dat.
- **Hervatten werkt.** Resultaten worden per antwoord weggeschreven. Breek je af met Ctrl+C en start
  je opnieuw, dan worden gedane cellen overgeslagen — je betaalt ze niet twee keer.
- Embeddings worden gecachet in `runs/<naam>/cache/`. Fase 2 hergebruikt de index die fase 1 al
  betaald heeft. Wijzig je een document, dan vervalt de cache automatisch.

---

## Hoe het aansluit op de app

De harness hergebruikt de echte code, zodat een meting zegt wat de app doet:

| Wat | Waar |
|---|---|
| PDF/DOCX lezen | `server/utils/inkoopbeleid/extract.ts` |
| In stukken knippen | `server/utils/rag-chunk.ts` (gedeeld met `ingestText`) |
| Fragmenten opmaken + prompt bouwen | `server/utils/inkoopbeleid/advice-prompt.ts` (gedeeld met `/api/inkoopbeleid/advies`) |
| Gateway, auth, headers | `server/mastra/gateways/openai-compat.ts` |
| Standaard system prompt | `prompts/adviseur-a-standaard.md`, kopie van `agent.inkoopbeleid.system` |

Twee dingen doet de harness bewust anders:

1. **Geen pgvector, maar een vectorlijst in het geheugen.** Elke configuratie heeft zijn eigen
   index nodig, op zijn eigen breedte. In Postgres betekent dat tabellen aanmaken en weggooien per
   cel, met het risico dat je in de live `rag_vectors` schrijft. Bij een paar honderd chunks is alles
   doorrekenen exact én sneller dan een index. Wat je meet — chunking en embeddings — is identiek.
2. **Niet via `mastra.getAgent()`.** Een agent haalt model én prompt uit de database, wat één
   globale instelling is, en biedt geen `temperature` of `topP`. Precies de knoppen die een sweep
   wil verdraaien. De harness bouwt daarom zijn eigen aanroep, met dezelfde prompt en dezelfde
   gateway.

## Buiten scope

- De **redacteur** (hoofdstukken schrijven). Werkt in principe met een tweede vragenlijst, maar
  lange teksten vragen een andere weergave in het rapport.
- De **toets-functie** (`/api/inkoopbeleid/toets`). Die rekent op databasetabellen, zonder taalmodel.
- **Automatisch laten scoren door een model.** Bewust niet: jij bepaalt wat goed is.

## Onderhoud

```bash
pnpm eval:typecheck   # typecheck van deze map (valt buiten `nuxi typecheck`)
pnpm test             # unit tests van expand, vector-store en checks
```
