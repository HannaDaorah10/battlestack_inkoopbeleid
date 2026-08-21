# Index

One-line summary of what each markdown file in this repo contains, so you can
jump straight to the right one instead of reading everything.

## Root

- [README.md](README.md) — what battlestack is, the `npx battlestack` happy path, and why it exists (versioned features + `pull`/`doctor` vs. frozen starter templates).
- [ARCHITECTURE.md](ARCHITECTURE.md) — how the plugin system actually works: the five packages, registries, loader, orchestrator, and known rough edges.
- [REPO.md](REPO.md) — plain-language map of the repo for newcomers; links out to README.md and ARCHITECTURE.md for depth.
- [CONTRIBUTING.md](CONTRIBUTING.md) — prerequisites, supported package managers (pnpm/npm/bun, not yarn), and what "works" has actually been verified against.
- [inkoopbeleid.md](inkoopbeleid.md) — explainer of the "0.2 Inkoopbeleid" assignment: what procurement policy is, sourced from two real policy PDFs, and where it fits in the Inkoophuis platform.

## Packages

- [packages/battlestack/README.md](packages/battlestack/README.md) — the unscoped `battlestack` npx wrapper; thin launcher, no logic of its own.
- [packages/cli/README.md](packages/cli/README.md) — `@battlestack/cli`, the CLI engine that the wrapper delegates to.
- [packages/core/README.md](packages/core/README.md) — `@battlestack/core`, the plugin SDK (types/registries/loader) for anyone writing a battlestack plugin.
- [packages/preset-nuxt4/README.md](packages/preset-nuxt4/README.md) — `@battlestack/preset-nuxt4`, the Nuxt 4 framework preset: its three templates and the features they compose from.
- [packages/tui/README.md](packages/tui/README.md) — `@battlestack/tui`, the shared terminal-UI layer (banner, spinner, prompts) used by the CLI and presets.
- [packages/preset-nuxt4/templates/ai-tool-config/claude-code/](packages/preset-nuxt4/templates/ai-tool-config/claude-code/) — Claude Code agent/command/skill/rule templates emitted into scaffolded projects (subagent config, TDD, plan-writing, code-review workflow, etc.); not project docs, skip unless working on that preset's AI tooling.

Not indexed: `my-app/node_modules/**/*.md` (third-party package READMEs/licenses, not project docs).
