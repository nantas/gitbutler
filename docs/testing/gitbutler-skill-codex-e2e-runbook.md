# GitButler Skill Codex E2E Runbook

This runbook explains how to run the Codex end-to-end harness for the GitButler `but` skill using the installed release CLI.

## Preconditions

- `but` is installed and on `PATH`
- `codex` is installed and authenticated
- `pnpm` dependencies for [`crates/but/skill/e2e`](/Volumes/Shuttle/projects/agentic/gitbutler/.worktrees/nantas-dev-codex-e2e/crates/but/skill/e2e) are installed

## Confirm The Installed CLI

Check which binary will be used:

```bash
which but
but --version
```

The harness assumes this installed `but` binary is the one under test. It does not build or invoke a repo-local `cargo build -p but` binary.

## Update The Installed CLI

Use the supported install/update path for your machine, then re-check the resolved binary and version:

```bash
which but
but --version
```

On this machine the CLI also advertises newer releases during normal commands, for example `0.19.5 -> 0.19.6`, so re-run `but --version` after upgrading to confirm the update took effect.

## Install Harness Dependencies

```bash
pnpm install --dir crates/but/skill/e2e --ignore-workspace --force
pnpm --dir crates/but/skill/e2e build
```

## Run One Scenario

```bash
pnpm --dir crates/but/skill/e2e eval --filter-pattern "independent-branch-choice"
```

## Run The Core Smoke Suite

```bash
pnpm --dir crates/but/skill/e2e eval --filter-pattern "independent-branch-choice|stacked-branch-choice|ambiguous-branch-type-asks-first|no-raw-git-writes"
```

## Run The Full Configured Suite

```bash
pnpm --dir crates/but/skill/e2e eval
```

## Run Repeated Evaluations

```bash
pnpm --dir crates/but/skill/e2e eval:repeat
```

## Artifact Locations

Each provider invocation creates a disposable temp directory and prints artifact paths through promptfoo metadata. The important files are:

- `prompt.txt`
- `last-message.txt`
- `codex-events.jsonl`
- `scenario.log`

If you need to inspect one run manually, the scenario temp directories are created under `${TMPDIR:-/tmp}` with names like `gitbutler-skill-e2e.one-stack.XXXXXX`.

## Skill Placement

The fixture setup step installs the real skill payload into `.agents/skills/gitbutler` inside the disposable repo before Codex runs. That means the agent is validated against the same skill files shipped from [`crates/but/skill`](/Volumes/Shuttle/projects/agentic/gitbutler/.worktrees/nantas-dev-codex-e2e/crates/but/skill).
