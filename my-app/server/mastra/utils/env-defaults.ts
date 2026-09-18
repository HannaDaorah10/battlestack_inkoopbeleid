// Single source for the env-derived model defaults. Deliberately import-free and reading
// `process.env` directly: consumed by runtime fallback (`ai-model.ts`), boot-time DB seeding
// (`model-configs.ts`), and the standalone seed runner / `mastra dev` Studio, none of which
// share a Nitro runtime context.
//
// The `||` fallbacks are last-resort literals, hit only when the matching NUXT_AI_GATEWAY_*_MODEL
// env var is unset - which happens on a genuinely fresh boot (first-ever seed of
// `ai_model_configs`) and on any later DB read failure. They used to be `openai/...` model ids,
// which this project's sluis.ai tenant rejects outright on EU-residency grounds (see AI-SETUP.md,
// "Stap 3b"): a fresh deploy without that env var set would seed a model config that fails on the
// first real call, with no indication anything was ever wrong until someone tried it.
// `bedrock/eu.anthropic.claude-sonnet-4-5-20250929-v1:0` / `bedrock/eu.cohere.embed-v4:0` are the
// models this tenant actually accepts (confirmed via `pnpm eval:models` and the retrieval sweep in
// tools/eval), matching what AI-SETUP.md tells a new environment to configure anyway. If this
// tenant's allowed providers ever change, update both here and in AI-SETUP.md together.
export function envModelDefault(kind: 'chat' | 'embedding'): string {
    if (kind === 'embedding') {
        return process.env.NUXT_AI_GATEWAY_EMBEDDING_MODEL || 'bedrock/eu.cohere.embed-v4:0'
    }
    return process.env.NUXT_AI_GATEWAY_CHAT_MODEL || 'bedrock/eu.anthropic.claude-sonnet-4-5-20250929-v1:0'
}
