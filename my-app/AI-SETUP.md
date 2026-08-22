# AI-SETUP.md — wat er nog moet gebeuren om de AI aan de praat te krijgen

Alle code is af. Wat ontbreekt zijn **twee dingen die alleen jij kunt regelen**: een AI-sleutel en
een draaiende database. Dit document is de volledige checklist, in volgorde.

Onderaan staat wat je aan de externe IT-partner moet doorgeven.

---

## In één zin

De app is gebouwd, maar de AI-onderdelen (adviseur, hoofdstuk schrijven, kennisbank) geven nu
`gateway-key-missing` terug, omdat `NUXT_AI_GATEWAY_KEY` in `my-app/.env` leeg is.

---

## Stap 1 — Zorg dat Docker draait

**Waarom:** de app slaat alles op in PostgreSQL en bewaart geüploade documenten in een lokale
S3-server (RustFS). Beide draaien in Docker. Zonder Docker start de app niet.

Op deze laptop staat op dit moment **geen Docker**. Dat heb ik gecontroleerd: geen Docker Desktop,
geen WSL.

1. Installeer **Docker Desktop** voor Windows: https://www.docker.com/products/docker-desktop/
2. Start Docker Desktop en wacht tot het icoon groen/"running" is.
3. Controleer in een terminal:
   ```bash
   docker --version
   ```
   Krijg je een versienummer? Dan is stap 1 klaar.

> **Let op — antivirus.** Op deze laptop draait **Acronis Cyber Protect**. Die heeft tijdens het
> installeren één bestand weggehaald dat de app nodig heeft om te bouwen
> (`rollup.win32-x64-msvc.node` in `node_modules`). Ik heb dat bestand teruggezet en het werkt nu,
> maar het kan opnieuw gebeuren. Vraag IT om een **uitzondering (exclusion)** in Acronis voor de map:
> ```
> c:\Users\Vibecoding\Documents\battlestack\my-app\node_modules
> ```
> Zonder die uitzondering kan `pnpm install` deze fout weer veroorzaken:
> `Cannot find module @rollup/rollup-win32-x64-msvc`.

---

## Stap 2 — Regel een AI-sleutel

Je hebt een sleutel nodig voor een **OpenAI-compatibele AI-gateway**. Er zijn twee routes.

### Route A (aanbevolen voor deze PoC): sluis.ai

Dit is waar het project al op is ingesteld. Het is een Nederlandse/EU-gehoste gateway met
EU-dataopslag, PII-filtering en een controleerbaar auditlogboek — precies wat je wilt kunnen laten
zien als je met beleidsdocumenten van een woningcorporatie werkt.

1. Ga naar https://sluis.ai en vraag een account/sleutel aan.
2. Je krijgt een sleutel die begint met `sk_live_`.
3. Ga door naar stap 3.

**Vraag bij het aanvragen om:**
- toegang tot een chatmodel (voor de adviseur), en
- toegang tot een embeddingmodel (voor het doorzoeken van documenten).

Beide zijn nodig. Alleen een chatmodel is niet genoeg.

### Route B: een andere aanbieder

Elke OpenAI-compatibele endpoint werkt, bijvoorbeeld OpenRouter of een eigen LiteLLM-proxy. Dan
verander je in stap 3 óók de regel `NUXT_AI_GATEWAY_URL`.

> **Belangrijk als je van aanbieder wisselt:** kies je een ander embeddingmodel, dan moet
> `NUXT_RAG_EMBEDDING_DIMENSIONS` in `.env` precies gelijk zijn aan het aantal getallen dat dat
> model teruggeeft. Nu staat die op `1536`, want dat is wat `openai/text-embedding-3-small`
> teruggeeft. Klopt het niet, dan zegt de app dat nu zelf, met een duidelijke foutmelding en de
> juiste waarde erin. (Vóór mijn aanpassing mislukte dat stil.)

---

## Stap 3 — Zet de sleutel in het .env-bestand

Open dit bestand:

```
c:\Users\Vibecoding\Documents\battlestack\my-app\.env
```

Zoek regel 84. Die is nu leeg:

```
NUXT_AI_GATEWAY_KEY=
```

Zet je sleutel erachter, zonder aanhalingstekens en zonder spaties:

```
NUXT_AI_GATEWAY_KEY=sk_live_hier_jouw_sleutel
```

Gebruik je Route B? Pas dan ook regel 82 aan:

```
NUXT_AI_GATEWAY_URL=https://api.sluis.ai
```

> **Deel dit bestand nooit.** `.env` staat in `.gitignore` en hoort daar te blijven. Zet je sleutel
> niet in een commit, niet in een screenshot, en niet in een chat.

---

## Stap 4 — Start alles op

Open een terminal in `c:\Users\Vibecoding\Documents\battlestack\my-app` en voer uit, in deze
volgorde:

```bash
battlestack up          # start postgres, mailpit, rustfs, redis
battlestack db:push     # maakt alle tabellen aan
battlestack db:seed     # maakt de admin-gebruiker + Ons Huis en Welbions aan
battlestack dev         # start de app
battlestack login       # opent een inloglink als admin
```

Werkt `battlestack` niet? Gebruik dan de pnpm-varianten:

```bash
pnpm run db:push
pnpm run db:seed
pnpm dev
```

---

## Stap 5 — Controleer of het werkt

Loop dit rijtje af. Elke stap moet slagen voordat je verdergaat.

| # | Wat je doet | Wat je moet zien |
|---|---|---|
| 1 | Ga naar `/chat` en stuur een bericht | Een antwoord. Zo niet: de sleutel klopt niet. |
| 2 | Ga naar `/dashboard/rag`, plak een alinea, klik Toevoegen, zoek er daarna op | Een resultaat mét een score. Zo niet: het embeddingmodel of de dimensie klopt niet. |
| 3 | Ga naar `/dashboard/inkoopbeleid` | Ons Huis en Welbions staan in de keuzelijst |
| 4 | Ga naar **Toets een inkoop**, vul `30000` in, kies *Diensten en leveringen*, klik Toets | Meervoudig onderhands, **2 offertes** |
| 5 | Nogmaals: `2500000`, *Werken* | **3 offertes**, categoriemanagement, adviseur inkoop verplicht |
| 6 | Ga naar **Documenten**, upload het inkoopbeleid van Ons Huis (PDF of .docx) | Een melding met het aantal fragmenten |
| 7 | Ga naar **Adviseur**, vraag: *"Hoeveel offertes heb ik nodig voor een schoonmaakcontract van € 30.000?"* | Een Nederlands antwoord dat het document als bron noemt |

Stap 4 en 5 werken **zonder** AI-sleutel: die rekenen op de tabellen in de database, niet op een
taalmodel. Handig om te weten — daarmee kun je het belangrijkste deel al demonstreren voordat de
sleutel er is.

---

## Wat je aan de IT-partner doorgeeft

Als de PoC is goedgekeurd, heeft de partner dit nodig:

1. **PostgreSQL 18 met de `pgvector`-extensie.** Zonder pgvector werkt het doorzoeken van
   documenten niet.
2. **Een S3-compatibele opslag** voor de geüploade documenten (`NUXT_S3_*` in `.env`).
3. **Redis** (optioneel, voor snellere rate limiting onder druk).
4. **De AI-gateway-sleutel** als omgevingsvariabele, niet in een bestand in de repo.
5. **Migraties draaien bij elke deploy.** Ze staan klaar in
   `server/database/migrations/` en worden automatisch toegepast bij het opstarten. De reference-data
   (Ons Huis, Welbions, drempelbedragen, mandaten) draai je één keer handmatig met
   `battlestack db:seed`.
6. **Antivirus-uitzondering** voor de `node_modules`-map op elke ontwikkelmachine, zie stap 1.

---

## Waar de AI-instellingen daarna te vinden zijn

Je hoeft hiervoor niet meer in de code:

- `/dashboard/settings/ai` — welk chatmodel en welk embeddingmodel elke agent gebruikt
- `/dashboard/prompts` — de teksten die de adviseur en de redacteur aansturen, in het Nederlands

De twee prompts die bij deze module horen heten:

- `agent.inkoopbeleid.system` — de adviseur die vragen beantwoordt
- `agent.inkoopbeleid.redacteur.system` — de redacteur die een hoofdstuk schrijft
