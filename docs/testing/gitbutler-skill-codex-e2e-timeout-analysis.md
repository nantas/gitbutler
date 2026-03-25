# GitButler Skill Codex E2E Timeout Analysis

This document records the investigation into why the full Codex E2E `eval` appeared to time out when run from the merged `nantas-dev` workspace.

## Summary

The timeout was not caused by the merged workspace itself.

The actual root cause was in the E2E harness:

- the custom Codex provider could block indefinitely because `spawnSync("codex", ...)` had no timeout
- the provider assumed `last-message.txt` would always exist, which is not guaranteed for partially completed Codex sessions
- one scenario used an overly strict natural-language assertion and failed on valid wording variations

After fixing those issues, the full suite passed from the merged `nantas-dev` workspace.

## What The Harness Actually Validates

The full `eval` does not run directly inside the repository worktree under test. Each scenario first creates a disposable fixture repository and then validates the real GitButler workflow inside that repository.

The fixture setup script does all of the following:

- materializes a disposable repository from `crates/but/tests/fixtures/scenario`
- copies the shipped skill payload into `.agents/skills/gitbutler`
- runs the installed `but setup`
- runs a real Codex session against that disposable repository
- asserts on both the Codex command trace and `but --json status`

Relevant implementation:

- fixture setup: [`crates/but/skill/e2e/setup-fixture.sh`](/Volumes/Shuttle/projects/agentic/gitbutler/crates/but/skill/e2e/setup-fixture.sh)
- provider entrypoint: [`crates/but/skill/e2e/providers/codex-integration.ts`](/Volumes/Shuttle/projects/agentic/gitbutler/crates/but/skill/e2e/providers/codex-integration.ts)

This means the E2E suite already validates the user requirement that agents work against:

- an installed `but` CLI
- a repo-local installed skill
- a real agent runtime

It does not rely on `cargo build -p but` for the test execution path.

## Root Cause Analysis

### 1. No Per-Scenario Codex Timeout

The provider used `spawnSync("codex", ...)` without a timeout. If a single scenario stalled inside Codex, the entire serial `promptfoo eval` would wait forever.

The fix adds a configurable per-scenario timeout with a default of `360000ms`:

- timeout configuration: [`crates/but/skill/e2e/providers/codex-integration.ts`](/Volumes/Shuttle/projects/agentic/gitbutler/crates/but/skill/e2e/providers/codex-integration.ts#L13)
- timeout application: [`crates/but/skill/e2e/providers/codex-integration.ts`](/Volumes/Shuttle/projects/agentic/gitbutler/crates/but/skill/e2e/providers/codex-integration.ts#L183)

### 2. Missing Transcript File Handling

Real Codex runs can emit `codex-events.jsonl` but still fail to leave `last-message.txt`. The original provider treated the transcript file as mandatory.

The fix adds a fallback path that recovers the last agent message from the parsed JSONL event stream:

- transcript fallback helper: [`crates/but/skill/e2e/providers/codex-integration.ts`](/Volumes/Shuttle/projects/agentic/gitbutler/crates/but/skill/e2e/providers/codex-integration.ts#L39)

The provider also retries once when a run times out or finishes without a final message.

### 3. Brittle Clarification Assertion

The `pick-target-ambiguity` scenario originally relied on a fixed-string clarification check. That was too strict for real agent output, where multiple semantically correct phrasings appeared.

Observed valid variants included:

- `Which target branch should receive the picked commit from \`unapplied-branch\`?`
- `Which target branch should receive the commit picked from \`unapplied-branch\`?`

The fix replaces the exact-match style check with a semantic assertion that accepts equivalent wording:

- semantic assertion: [`crates/but/skill/e2e/assertions/codex-assertions.ts`](/Volumes/Shuttle/projects/agentic/gitbutler/crates/but/skill/e2e/assertions/codex-assertions.ts#L113)
- scenario usage: [`crates/but/skill/e2e/scenarios/pick-target-ambiguity.yaml`](/Volumes/Shuttle/projects/agentic/gitbutler/crates/but/skill/e2e/scenarios/pick-target-ambiguity.yaml#L11)

## Why This Was Misread As A Merged-Workspace Problem

The failing runs were launched from the merged `nantas-dev` workspace, so the symptom looked workspace-specific.

However, the workspace only hosts the harness code and the shipped skill content. The actual repositories used by the scenarios are disposable fixture repos created at runtime. Because of that, the workspace itself was not the execution target being mutated or evaluated.

The merged workspace exposed the problem because it ran the full suite in one place, but it was not the source of the timeout behavior.

## Promptfoo Assessment

The investigation does not support replacing `promptfoo` as the primary fix.

Within this harness, `promptfoo` is mainly the serial scenario orchestrator. The blocking behavior came from the custom provider implementation, not from `promptfoo` itself.

Replacing `promptfoo` could still be reasonable for secondary goals such as:

- reducing dependency surface
- gaining tighter control over logs and retries
- simplifying the result model

But it is not required to fix the timeout that was observed here.

## Verification Evidence

Fresh verification from the merged `nantas-dev` workspace on March 25, 2026:

- `pnpm --dir crates/but/skill/e2e test assertions`
  - passed: `14/14`
- `pnpm --dir crates/but/skill/e2e test providers`
  - passed: `4/4`
- `pnpm --dir crates/but/skill/e2e eval --filter-pattern 'pick-target-ambiguity' --repeat 5`
  - passed: `5/5`
- `pnpm --dir crates/but/skill/e2e eval`
  - passed: `8/8`
  - failures: `0`
  - errors: `0`
  - duration: `10m 47s`

## Practical Conclusion

The current E2E harness already validates the workflow that matters for the `but` skill:

- the test repository runs real `but setup`
- the test repository receives a real repo-local skill install
- a real Codex agent uses that installed skill
- assertions inspect the resulting command trace and repository state

The timeout issue is now explained by harness robustness gaps, not by an inability of the merged workspace to support the workflow.
