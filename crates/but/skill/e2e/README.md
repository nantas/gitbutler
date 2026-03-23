# GitButler But Skill Codex E2E

This directory contains the Codex-first Tier 4 harness for the GitButler `but` skill.

## Scope

- real disposable repositories
- installed release `but` CLI
- real skill payload copied into `.agents/skills/gitbutler`
- real Codex runtime
- command trace capture and repository-state assertions

## Layout

- `providers/` - runtime adapter for real Codex execution
- `assertions/` - shared assertion helpers used by scenario config
- `scenarios/` - prompt and fixture scenario definitions
- `setup-fixture.sh` - disposable repository setup and skill installation
- `artifacts/` - per-scenario output for transcripts and traces

## Environment

Expected tools:

- `but` on `PATH`
- `codex` on `PATH`
- Node compatible with this package

## Commands

```bash
pnpm install --dir crates/but/skill/e2e --ignore-workspace
pnpm build
pnpm run eval
pnpm run eval:repeat
pnpm run view
```

## Fixture Setup

Use the helper script to prepare a disposable repository from an existing Rust test scenario:

```bash
./setup-fixture.sh one-stack
```

The script will:

- materialize the named fixture into a temp directory
- canonicalize the repo path with `pwd -P`
- run the installed `but setup`
- copy `crates/but/skill/SKILL.md` and `references/` into `.agents/skills/gitbutler`
- exclude `.agents/`, `.but-data/`, and `.tmp/` from Git status noise
- print machine-readable repo and artifact paths
