import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { FLAG_LABELS } from '../checks'

/**
 * The blind side-by-side review page.
 *
 * This is the deliverable a non-technical colleague actually opens, so it is one self-contained
 * file: no server, no login, no network. Open it from a mail attachment and it works; press Ctrl+P
 * and it becomes a readable PDF.
 *
 * Two design choices carry most of the weight:
 *
 * - Answers are labelled A, B, C and never by model. A reader shown "GPT-4o" judges the brand
 *   before the sentence; the mapping stays in `sleutel.csv` with whoever ran the sweep.
 * - The order of the answers is shuffled per question, with a seed derived from the question id.
 *   Readers favour whatever sits at the top, and a fixed order would hand that bonus to the same
 *   configuration on every question. Seeding it keeps the page reproducible.
 */

export interface ReviewCase {
    id: string
    vraag: string
    organisatie: string
    fragmenten: string[]
}

export interface ReviewAnswer {
    label: string
    caseId: string
    sampleIndex: number
    answer: string
    error: string | null
    flags: string[]
}

export interface ReviewPageData {
    sweepName: string
    /**
     * Which phase-1 configuration produced the context these answers were generated from. Part of
     * the page title (and, through `document.title`, of the reviewer's autosave key in
     * localStorage) so two `beoordeling.html` files from the same sweep but different retrieval
     * settings never collide when opened in the same browser.
     */
    retrievalConfigId: string
    cases: readonly ReviewCase[]
    answers: readonly ReviewAnswer[]
}

/**
 * Configurations are shown to reviewers as "Configuratie A", "B", "C".
 *
 * Blind on purpose. Shown a model name, a reader judges the brand: a familiar name reads as
 * trustworthy and an unfamiliar one as suspect, before a word of the answer is read. The mapping
 * lives in `sleutel.csv`, which stays with whoever runs the sweep.
 *
 * Past Z it continues AA, AB - a sweep of more than 26 configurations is unwieldy to review, but it
 * should not produce two answers labelled the same.
 */
export function blindLabel(index: number): string {
    let label = ''
    let n = index
    do {
        label = String.fromCharCode(65 + (n % 26)) + label
        n = Math.floor(n / 26) - 1
    } while (n >= 0)
    return label
}

export async function buildReviewPage(file: string, data: ReviewPageData): Promise<void> {
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, renderReviewPage(data), 'utf8')
}

export function renderReviewPage(data: ReviewPageData): string {
    const byCase = new Map<string, ReviewAnswer[]>()
    for (const answer of data.answers) {
        const bucket = byCase.get(answer.caseId) ?? []
        bucket.push(answer)
        byCase.set(answer.caseId, bucket)
    }

    const sections = data.cases.map((evalCase, index) => {
        const answers = shuffleSeeded(byCase.get(evalCase.id) ?? [], evalCase.id)
        return renderCase(evalCase, index + 1, data.cases.length, answers)
    }).join('\n')

    const questionCount = data.cases.length
    const perQuestion = data.cases.length > 0 ? Math.round(data.answers.length / data.cases.length) : 0

    return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Beoordeling AI-antwoorden - ${escapeHtml(data.sweepName)} (${escapeHtml(data.retrievalConfigId)})</title>
<style>${STYLES}</style>
</head>
<body>
<header class="intro">
    <h1>Welk antwoord is goed?</h1>
    <p class="lead">
        Hieronder staan ${questionCount} vragen over het inkoopbeleid. Per vraag ziet u ongeveer
        ${perQuestion} antwoorden, gegeven door verschillende instellingen van de AI-adviseur.
        Welke instelling welk antwoord gaf, staat er expres niet bij: het gaat om het antwoord,
        niet om de naam van het model.
    </p>
    <h2>Waar let u op?</h2>
    <ol>
        <li><strong>Klopt het?</strong> Vooral bedragen, aantallen offertes en wie moet tekenen.
            Als u twijfelt, kijk in het beleidsdocument zelf - een antwoord dat overtuigend klinkt
            maar niet klopt, is het gevaarlijkst.</li>
        <li><strong>Staat de bron erbij?</strong> Een antwoord hoort te verwijzen naar het document
            waar het vandaan komt.</li>
        <li><strong>Is het te lezen?</strong> Zou u dit zo naar een collega sturen?</li>
        <li><strong>Wordt er eerlijk "ik weet het niet" gezegd</strong> als het beleid er niets
            over zegt? Dat is een goed antwoord, geen slecht.</li>
    </ol>
    <p>
        Kies per antwoord <strong>Goed</strong>, <strong>Twijfel</strong> of <strong>Fout</strong>.
        Twijfelt u, licht het dan kort toe - die toelichting is vaak waardevoller dan het oordeel.
        U hoeft niet in een keer klaar te zijn: uw antwoorden blijven in deze browser bewaard.
        Reken op ongeveer ${Math.max(5, Math.round(questionCount * perQuestion * 0.5))} minuten.
    </p>
    <div class="who no-print">
        <label for="beoordelaar">Uw naam</label>
        <input id="beoordelaar" type="text" placeholder="bijv. Sanne de Vries" autocomplete="name">
    </div>
    <div class="actions no-print">
        <button type="button" id="download">Download mijn beoordeling</button>
        <button type="button" id="wissen" class="secondary">Begin opnieuw</button>
        <span id="voortgang" class="voortgang"></span>
    </div>
    <p class="hint no-print">
        Klaar? Klik op <em>Download mijn beoordeling</em> en stuur het bestand terug.
    </p>
</header>

${sections}

<footer class="intro">
    <p class="hint">
        Gegenereerd voor sweep "${escapeHtml(data.sweepName)}" (retrieval-configuratie
        ${escapeHtml(data.retrievalConfigId)}). Uw oordelen staan alleen in deze browser totdat u
        ze downloadt; er wordt niets verstuurd.
    </p>
</footer>

<script>${SCRIPT}</script>
<script id="meta" type="application/json">${jsonForScript({ sweepName: data.sweepName, retrievalConfigId: data.retrievalConfigId })}</script>
</body>
</html>
`
}

function renderCase(
    evalCase: ReviewCase,
    position: number,
    total: number,
    answers: readonly ReviewAnswer[],
): string {
    const cards = answers.map((answer) => renderAnswer(evalCase.id, answer)).join('\n')
    const sources = evalCase.fragmenten.length > 0
        ? `<p class="bronnen">Gezochte documenten: ${escapeHtml(evalCase.fragmenten.join(', '))}</p>`
        : '<p class="bronnen waarschuwing">Er zijn geen fragmenten in de documenten gevonden voor deze vraag.</p>'

    return `<section class="vraag" id="case-${escapeHtml(evalCase.id)}">
    <div class="vraag-kop">
        <span class="teller">Vraag ${position} van ${total}</span>
        <h2>${escapeHtml(evalCase.vraag)}</h2>
        ${sources}
    </div>
    <div class="antwoorden">
${cards}
    </div>
</section>`
}

function renderAnswer(caseId: string, answer: ReviewAnswer): string {
    const key = `${caseId}|${answer.label}|${answer.sampleIndex}`

    const flags = answer.flags.length > 0
        ? `<ul class="vlaggen">${answer.flags
            .map((f) => `<li>${escapeHtml(FLAG_LABELS[f] ?? f)}</li>`)
            .join('')}</ul>`
        : ''

    const body = answer.error
        ? `<p class="fout">Deze instelling gaf geen antwoord: ${escapeHtml(answer.error)}</p>`
        : `<div class="tekst">${paragraphs(answer.answer)}</div>`

    return `        <article class="antwoord" data-key="${escapeHtml(key)}">
            <h3>Configuratie ${escapeHtml(answer.label)}</h3>
            ${body}
            ${flags}
            <div class="oordeel no-print" role="group" aria-label="Oordeel over configuratie ${escapeHtml(answer.label)}">
                <button type="button" data-oordeel="goed">Goed</button>
                <button type="button" data-oordeel="twijfel">Twijfel</button>
                <button type="button" data-oordeel="fout">Fout</button>
            </div>
            <label class="opmerking no-print">
                <span>Toelichting (optioneel)</span>
                <textarea rows="2" placeholder="Wat klopt er niet, of wat is juist goed?"></textarea>
            </label>
        </article>`
}

/**
 * Deterministic shuffle: same input, same order, every time the report is regenerated.
 *
 * `Math.random` would reshuffle on every rebuild, so two reviewers sent "the same" page could see
 * different orders and their comments about "the second answer" would no longer line up.
 */
function shuffleSeeded<T>(items: readonly T[], seed: string): T[] {
    const random = mulberry32(hashSeed(seed))
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[out[i], out[j]] = [out[j]!, out[i]!]
    }
    return out
}

function hashSeed(text: string): number {
    let hash = 2166136261
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i)
        hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0
}

function mulberry32(seed: number): () => number {
    let a = seed
    return () => {
        a |= 0
        a = (a + 0x6D2B79F5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function paragraphs(text: string): string {
    return text
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter((block) => block.length > 0)
        .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
        .join('')
}

export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

/** `</script>` inside embedded JSON would end the script tag early and break the page. */
function jsonForScript(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c')
}

const STYLES = `
:root {
    color-scheme: light;
    --ink: #1a1a1a;
    --muted: #5b5b5b;
    --line: #d9d9d9;
    --paper: #ffffff;
    --ground: #f5f4f1;
    --goed: #1c6b3f;
    --twijfel: #8a6100;
    --fout: #a32222;
}
* { box-sizing: border-box; }
body {
    margin: 0;
    padding: 0 1rem 4rem;
    background: var(--ground);
    color: var(--ink);
    font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.intro, .vraag {
    max-width: 78rem;
    margin: 1.5rem auto;
    padding: 1.5rem 2rem;
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 10px;
}
h1 { font-size: 1.7rem; margin: 0 0 .5rem; }
h2 { font-size: 1.2rem; margin: 1.4rem 0 .5rem; }
h3 { font-size: 1rem; margin: 0 0 .6rem; letter-spacing: .02em; text-transform: uppercase; color: var(--muted); }
.lead { font-size: 1.05rem; }
.hint { color: var(--muted); font-size: .92rem; }
.who { margin: 1.2rem 0 .6rem; display: flex; gap: .6rem; align-items: center; flex-wrap: wrap; }
.who label { font-weight: 600; }
.who input { padding: .5rem .7rem; border: 1px solid var(--line); border-radius: 6px; font: inherit; min-width: 16rem; }
.actions { display: flex; gap: .6rem; align-items: center; flex-wrap: wrap; }
button {
    font: inherit;
    padding: .5rem .9rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--paper);
    cursor: pointer;
}
button:hover { border-color: var(--ink); }
#download { background: var(--ink); color: var(--paper); border-color: var(--ink); }
button.secondary { color: var(--muted); }
.voortgang { color: var(--muted); font-size: .92rem; }
.teller { display: block; color: var(--muted); font-size: .85rem; text-transform: uppercase; letter-spacing: .05em; }
.vraag-kop h2 { margin: .3rem 0 .4rem; font-size: 1.25rem; }
.bronnen { color: var(--muted); font-size: .88rem; margin: 0 0 1rem; }
.bronnen.waarschuwing { color: var(--fout); }
.antwoorden {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(21rem, 1fr));
    gap: 1rem;
}
.antwoord {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
}
.antwoord[data-gekozen="goed"] { border-color: var(--goed); box-shadow: inset 3px 0 0 var(--goed); }
.antwoord[data-gekozen="twijfel"] { border-color: var(--twijfel); box-shadow: inset 3px 0 0 var(--twijfel); }
.antwoord[data-gekozen="fout"] { border-color: var(--fout); box-shadow: inset 3px 0 0 var(--fout); }
.tekst { flex: 1; }
.tekst p { margin: 0 0 .7rem; }
.fout { color: var(--fout); }
.vlaggen { margin: .4rem 0 .8rem; padding-left: 1.1rem; color: var(--fout); font-size: .88rem; }
.oordeel { display: flex; gap: .4rem; margin-top: .6rem; }
.oordeel button[aria-pressed="true"][data-oordeel="goed"] { background: var(--goed); color: var(--paper); border-color: var(--goed); }
.oordeel button[aria-pressed="true"][data-oordeel="twijfel"] { background: var(--twijfel); color: var(--paper); border-color: var(--twijfel); }
.oordeel button[aria-pressed="true"][data-oordeel="fout"] { background: var(--fout); color: var(--paper); border-color: var(--fout); }
.opmerking { display: block; margin-top: .6rem; }
.opmerking span { display: block; font-size: .85rem; color: var(--muted); margin-bottom: .2rem; }
.opmerking textarea { width: 100%; font: inherit; padding: .5rem; border: 1px solid var(--line); border-radius: 6px; resize: vertical; }
@media print {
    body { background: var(--paper); padding: 0; }
    .no-print { display: none !important; }
    .intro, .vraag { border: none; margin: 0; padding: 0 0 1rem; max-width: none; }
    .vraag { break-after: page; }
    .vraag:last-of-type { break-after: auto; }
    .antwoord { break-inside: avoid; }
}
`

const SCRIPT = `
(function () {
    var sleutel = 'inkoopbeleid-beoordeling-' + document.title;
    var opgeslagen = {};

    try { opgeslagen = JSON.parse(localStorage.getItem(sleutel) || '{}'); } catch (e) { opgeslagen = {}; }

    function bewaar() {
        // A browser in private mode, or one told to block site data, throws here. Losing the
        // autosave is survivable; taking the page down with it is not.
        try { localStorage.setItem(sleutel, JSON.stringify(opgeslagen)); } catch (e) {}
        voortgang();
    }

    var kaarten = Array.prototype.slice.call(document.querySelectorAll('.antwoord'));
    var naamVeld = document.getElementById('beoordelaar');

    if (naamVeld) {
        naamVeld.value = opgeslagen.__naam || '';
        naamVeld.addEventListener('input', function () {
            opgeslagen.__naam = naamVeld.value;
            bewaar();
        });
    }

    kaarten.forEach(function (kaart) {
        var key = kaart.getAttribute('data-key');
        var staat = opgeslagen[key] || {};
        var knoppen = Array.prototype.slice.call(kaart.querySelectorAll('[data-oordeel]'));
        var opmerking = kaart.querySelector('textarea');

        function toon() {
            knoppen.forEach(function (knop) {
                knop.setAttribute('aria-pressed', String(knop.getAttribute('data-oordeel') === staat.oordeel));
            });
            if (staat.oordeel) kaart.setAttribute('data-gekozen', staat.oordeel);
            else kaart.removeAttribute('data-gekozen');
        }

        knoppen.forEach(function (knop) {
            knop.addEventListener('click', function () {
                var waarde = knop.getAttribute('data-oordeel');
                // Clicking the active choice clears it, so a misclick does not force a verdict.
                staat.oordeel = staat.oordeel === waarde ? null : waarde;
                opgeslagen[key] = staat;
                toon();
                bewaar();
            });
        });

        if (opmerking) {
            opmerking.value = staat.opmerking || '';
            opmerking.addEventListener('input', function () {
                staat.opmerking = opmerking.value;
                opgeslagen[key] = staat;
                bewaar();
            });
        }

        toon();
    });

    function voortgang() {
        var gedaan = kaarten.filter(function (kaart) {
            var staat = opgeslagen[kaart.getAttribute('data-key')];
            return staat && staat.oordeel;
        }).length;
        var el = document.getElementById('voortgang');
        if (el) el.textContent = gedaan + ' van ' + kaarten.length + ' beoordeeld';
    }

    function csv() {
        var naam = (naamVeld && naamVeld.value) || 'onbekend';
        var regels = ['beoordelaar;caseId;label;trekking;oordeel;opmerking'];
        kaarten.forEach(function (kaart) {
            var key = kaart.getAttribute('data-key');
            var staat = opgeslagen[key] || {};
            if (!staat.oordeel && !staat.opmerking) return;
            var delen = key.split('|');
            regels.push([naam, delen[0], delen[1], delen[2], staat.oordeel || '', staat.opmerking || '']
                .map(function (veld) {
                    var tekst = String(veld);
                    return /[";\\r\\n]/.test(tekst) ? '"' + tekst.replace(/"/g, '""') + '"' : tekst;
                }).join(';'));
        });
        return '\\uFEFF' + regels.join('\\r\\n') + '\\r\\n';
    }

    var knopDownload = document.getElementById('download');
    if (knopDownload) {
        knopDownload.addEventListener('click', function () {
            var naam = ((naamVeld && naamVeld.value) || 'beoordelaar').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
            var blob = new Blob([csv()], { type: 'text/csv;charset=utf-8' });
            var link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'beoordeling-' + naam + '.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
        });
    }

    var knopWissen = document.getElementById('wissen');
    if (knopWissen) {
        knopWissen.addEventListener('click', function () {
            if (!confirm('Al uw oordelen en toelichtingen wissen?')) return;
            opgeslagen = {};
            try { localStorage.removeItem(sleutel); } catch (e) {}
            location.reload();
        });
    }

    voortgang();
})();
`
