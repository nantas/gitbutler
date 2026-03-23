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
