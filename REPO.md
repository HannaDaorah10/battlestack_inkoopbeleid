# REPO.md — battlestack, explained simply

This file is a quick, plain-language map of the repo. For more depth, see
[README.md](README.md) (what the tool does and how to use it) and
[ARCHITECTURE.md](ARCHITECTURE.md) (how the plugin system really works
under the hood).

## What is this?

**battlestack** is a command-line tool that generates ready-to-run web
projects. You run `npx battlestack@latest my-app`, answer a few questions,
and it hands you a working [Nuxt](https://nuxt.com) (a web framework built
on Vue) app — already wired up with things like login, a database, Docker,
and CI, instead of a bare folder you still have to configure yourself.

The twist: it doesn't just copy a frozen template once. Every generated
project remembers exactly which pieces it was built from, so later on you
can run `battlestack pull` to pull in bugfixes and improvements from
battlestack itself — like a package manager, but for your whole starter
kit, not just its dependencies.

It's built and used by **SevenLab** for their own and client projects.

## How the repo is organized

This is a **pnpm monorepo** — one git repo containing several separate npm
packages that depend on each other, all managed together with the `pnpm`
package manager. The packages live under [packages/](packages/):

| Package | npm name | What it does |
| --- | --- | --- |
| [battlestack](packages/battlestack/) | `battlestack` | The tiny wrapper that makes `npx battlestack` and `bstack` work. Just 4 lines of code that hand off to `@battlestack/cli`. |
| [cli](packages/cli/) | `@battlestack/cli` | The real engine. Reads what you typed, asks questions, and runs the right commands (`dev`, `add`, `pull`, `doctor`, etc.). |
| [core](packages/core/) | `@battlestack/core` | The rulebook. Defines what a "feature," "template," or "plugin" is, and figures out what order things should run in. Contains no Nuxt-specific code at all. |
| [preset-nuxt4](packages/preset-nuxt4/) | `@battlestack/preset-nuxt4` | The actual Nuxt know-how: 3 templates and ~39 optional features (auth, database, Docker, AI chat, i18n, etc.), plus the file templates that get copied into your new project. |
| [tui](packages/tui/) | `@battlestack/tui` | Shared terminal look-and-feel: banners, colors, spinners, and interactive prompts, reused by both `cli` and `preset-nuxt4`. |

Think of it as: **`battlestack`** is the ignition key, **`cli`** is the
engine, **`core`** is the rulebook the engine follows, **`preset-nuxt4`**
is the Nuxt-specific content it loads, and **`tui`** is the dashboard
lights shared by all of them.

## How the pieces fit together (the plugin system)

battlestack doesn't hardcode "Nuxt" anywhere in its core. Instead:

- A **plugin** is just an npm package that registers things (features,
  templates, commands) with battlestack. `preset-nuxt4` is one such
  plugin — the one that ships built-in, but written using the exact same
  API anyone else could use to write their own.
- A **feature** is one optional building block — "add authentication,"
  "add a Postgres database," "add Docker." Templates are curated bundles
  of features.
- A **template** is a starting point made of required + optional features
  — e.g. `nuxt4-minimal` (just Nuxt + styling, no backend), `nuxt4-fullstack`
  (adds a database and login), `nuxt4-ai` (adds AI chat on top of that).
- Every generated project gets a small file, `.battlestack/manifest.json`,
  recording exactly which feature versions were used — this is what lets
  `battlestack doctor` spot drift and `battlestack pull` bring in updates
  safely, without clobbering files you've hand-edited.

The `core` package never depends on `cli` or `preset-nuxt4` — dependencies
only flow one way (rulebook → engine → content), never backwards. Where a
lower-level package still needs something from a higher one (like printing
to the terminal), it goes through a small "plug socket" interface instead
of importing it directly, so the layers don't get tangled into a circular
dependency.

## Everyday commands (for using the generated app)

```
battlestack dev          # start the dev server (and database, if any)
battlestack add <id>     # add an optional feature after the fact
battlestack pull         # pull in upstream fixes/updates
battlestack doctor       # check for drift / missing config
battlestack login        # open a browser already signed in (dev only)
```

`bstack` is a shorter alias for `battlestack` — same tool, either name.

## Tooling, testing, and CI

- **Package manager:** [pnpm](https://pnpm.io) (Node.js 24+ required).
  `pnpm-workspace.yaml` lists which folders under `packages/` are part of
  the workspace.
- **Tests:** [Vitest](https://vitest.dev), one shared config
  ([vitest.config.ts](vitest.config.ts)) covering every package's `test/`
  folder. Run with `pnpm test`.
- **Type-checking:** `pnpm tsc` checks all the TypeScript code. The
  `templates/` folders (file content copied into *generated* projects) are
  deliberately skipped, since that content depends on packages that only
  exist in a real generated project, not in this repo.
- **Build:** `pnpm build` compiles every package in dependency order
  (core → tui → preset-nuxt4 → cli), then
  [scripts/build-post.mjs](scripts/build-post.mjs) marks the CLI's
  compiled entry file as executable.
- **CI** ([.github/workflows/](.github/workflows/)):
  - `ci.yml` — on every push/PR: type-checks and tests on Linux (Node 24 &
    26), actually scaffolds a real Nuxt project and tests *that* (the only
    place template content gets checked), and repeats build/test/scaffold
    checks on Windows.
  - `release.yml` — on a version tag, publishes all 5 packages to npm.
- **Manual verification scripts** in [scripts/](scripts/) (not run
  automatically in CI, run by hand when needed):
  - `demo.ts` — shows off the CLI's behavior for a quick look.
  - `pack-smoke.mjs` / `pack-smoke-matrix.mjs` — package the tool up like
    a real npm release and test-install it, to catch "works here, breaks
    when published" problems. The matrix version also checks npm and bun,
    not just pnpm.
  - `migrate-lock-race.mjs` — stress-tests the database migration locking
    logic used inside *generated* projects, to prove two app instances
    starting at once can't both apply the same migration twice.

## Where to look next

- [README.md](README.md) — full usage guide: templates, features, the AI
  gateway, installing/updating, troubleshooting.
- [ARCHITECTURE.md](ARCHITECTURE.md) — the deep technical dive: plugin
  IDs, feature execution ordering, the plugin API, and known rough edges.
- [CONTRIBUTING.md](CONTRIBUTING.md) — local dev setup and what CI checks.
