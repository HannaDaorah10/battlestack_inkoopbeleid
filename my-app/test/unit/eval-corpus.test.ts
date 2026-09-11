import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadCorpus, organisationsIn } from '../../tools/eval/src/corpus'

const cleanup: string[] = []

afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function tempDir(files: Record<string, string>): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'eval-corpus-'))
    for (const [name, content] of Object.entries(files)) {
        await writeFile(join(dir, name), content, 'utf8')
    }
    cleanup.push(dir)
    return dir
}

describe('loadCorpus - dir entries', () => {
    it('reads every supported file in the directory, sorted by name', { timeout: 120_000 }, async () => {
        const dir = await tempDir({
            'b-tweede.txt': 'tweede document',
            'a-eerste.txt': 'eerste document',
            // Present in every real corpus folder; must not be mistaken for a document.
            '.gitkeep': '',
        })

        const documents = await loadCorpus([{ dir, organisatie: 'ons-huis' }])

        expect(documents.map((d) => d.title)).toEqual(['a-eerste', 'b-tweede'])
        expect(documents.every((d) => d.organisatie === 'ons-huis')).toBe(true)
    })

    it('keeps each directory scoped to its own organisatie', { timeout: 120_000 }, async () => {
        const onsHuis = await tempDir({ 'beleid.txt': 'inhoud ons huis' })
        const welbions = await tempDir({ 'wijzer.txt': 'inhoud welbions' })

        const documents = await loadCorpus([
            { dir: onsHuis, organisatie: 'ons-huis' },
            { dir: welbions, organisatie: 'welbions' },
        ])

        expect(organisationsIn(documents)).toEqual(new Set(['ons-huis', 'welbions']))
    })

    it('throws a readable error for a missing directory', { timeout: 120_000 }, async () => {
        await expect(loadCorpus([{ dir: 'corpus/does-not-exist', organisatie: 'ons-huis' }]))
            .rejects.toThrow(/Kan map .* niet lezen/)
    })

    it('throws when a directory has no supported documents', { timeout: 120_000 }, async () => {
        const dir = await tempDir({ 'foto.jpg': 'geen echte jpeg' })

        await expect(loadCorpus([{ dir, organisatie: 'ons-huis' }]))
            .rejects.toThrow(/Geen ondersteunde documenten/)
    })
})
