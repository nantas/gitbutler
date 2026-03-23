# But Skill Codex E2E Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add real end-to-end evaluation coverage proving that a disposable repository can be set up with the installed `but` CLI, receive the real GitButler skill under `.agents/skills/gitbutler`, and guide a Codex agent through correct `but`-based workflows.

**Architecture:** Build a Tier 4-style harness under `crates/but/skill/e2e/` that creates disposable repositories, runs the installed `but` binary for `setup`, installs the real skill payload into `.agents/skills/gitbutler`, invokes a real Codex agent with natural-language tasks, records command traces, and asserts both workflow behavior and final repository state. Keep the first implementation focused on Codex plus the installed release CLI so we can validate the product promise before extending CLI install formats or adding other agent runtimes.

**Tech Stack:** Rust test suite, shell fixture setup, TypeScript-based provider/harness, promptfoo-style scenario config, installed `but` CLI, Codex agent runtime.

---

### Task 1: Reconcile Skill Testing Documentation With Repository Reality

**Files:**
- Modify: `crates/but/skill/README.md`
- Modify: `crates/but/skill/RESEARCH.md`
- Test: `docs/plans/2026-03-23-but-skill-codex-e2e-design.md`

**Step 1: Write the failing documentation expectation**

Document the mismatch to correct:

- `README.md` currently points to `crates/but/skill/eval/`
- `RESEARCH.md` currently describes a Tier 4 harness that is absent on this branch
- the new implementation target is `crates/but/skill/e2e/`

**Step 2: Verify the mismatch exists**

Run: `rg -n "crates/but/skill/eval|setup-fixture.sh|pnpm run eval|eval:codex" crates/but/skill/README.md crates/but/skill/RESEARCH.md`

Expected: matches in both docs pointing to the missing `eval/` path.

**Step 3: Write minimal documentation updates**

Update both docs so they describe:

- the new `crates/but/skill/e2e/` directory
- Codex-first scope
- installed release CLI baseline
- `.agents/skills/gitbutler` skill placement for the harness
- future extension points for Claude or local-build matrices

**Step 4: Re-run the grep to verify docs now reference the correct path**

Run: `rg -n "crates/but/skill/e2e|\\.agents/skills/gitbutler|Codex" crates/but/skill/README.md crates/but/skill/RESEARCH.md`

Expected: positive matches for the new path and runtime assumptions.

**Step 5: Commit**

```bash
git add crates/but/skill/README.md crates/but/skill/RESEARCH.md
git commit -m "docs: align skill docs with codex e2e harness"
```

### Task 2: Scaffold the Codex E2E Harness Layout

**Files:**
- Create: `crates/but/skill/e2e/package.json`
- Create: `crates/but/skill/e2e/tsconfig.json`
- Create: `crates/but/skill/e2e/promptfooconfig.yaml`
- Create: `crates/but/skill/e2e/README.md`
- Create: `crates/but/skill/e2e/providers/codex-integration.ts`
- Create: `crates/but/skill/e2e/assertions/codex-assertions.ts`
- Create: `crates/but/skill/e2e/scenarios/`
- Test: `crates/but/skill/e2e/package.json`

**Step 1: Write the failing harness expectation**

Define the required layout in `README.md`:

- provider entrypoint
- assertions helper
- scenario config
- fixture setup script
- output artifact directory

**Step 2: Verify the directory does not exist yet**

Run: `test -d crates/but/skill/e2e`

Expected: non-zero exit status.

**Step 3: Write the minimal scaffold**

Create:

- `package.json` with scripts for `build`, `eval`, `eval:repeat`, `view`
- `tsconfig.json`
- `promptfooconfig.yaml` with a placeholder provider and scenario list
- `README.md` explaining environment variables and execution flow
- empty but compilable TypeScript modules for provider and assertions

**Step 4: Run the TypeScript build to verify the scaffold compiles**

Run: `pnpm --dir crates/but/skill/e2e install --ignore-workspace && pnpm --dir crates/but/skill/e2e build`

Expected: install succeeds and TypeScript compilation passes without runtime execution.

**Step 5: Commit**

```bash
git add crates/but/skill/e2e
git commit -m "test: scaffold codex e2e harness"
```

### Task 3: Add Disposable Repository Fixture Setup

**Files:**
- Create: `crates/but/skill/e2e/setup-fixture.sh`
- Modify: `crates/but/skill/e2e/README.md`
- Test: `crates/but/skill/e2e/setup-fixture.sh`

**Step 1: Write the failing fixture contract**

The script must:

- create a disposable repo from a named scenario
- canonicalize the path with `pwd -P`
- run installed `but setup`
- place the real skill into `.agents/skills/gitbutler`
- add support paths to `.git/info/exclude`
- emit machine-readable paths for later assertions

**Step 2: Verify the script is absent**

Run: `test -f crates/but/skill/e2e/setup-fixture.sh`

Expected: non-zero exit status.

**Step 3: Write the minimal fixture setup script**

Implement shell steps in order:

1. create temp working directory
2. initialize or copy the requested fixture repository
3. run installed `but setup`
4. copy `crates/but/skill/SKILL.md` and `crates/but/skill/references/` into `.agents/skills/gitbutler`
5. exclude `.agents/`, `.but-data/`, `.tmp/`, and artifact paths from Git status
6. print the canonical repo path and artifact directory

**Step 4: Run the script against one simple scenario**

Run: `crates/but/skill/e2e/setup-fixture.sh one-stack`

Expected:

- exit code 0
- repo ends on `gitbutler/workspace`
- `.agents/skills/gitbutler/SKILL.md` exists
- `.git/info/exclude` contains the support directories

**Step 5: Commit**

```bash
git add crates/but/skill/e2e/setup-fixture.sh crates/but/skill/e2e/README.md
git commit -m "test: add codex e2e fixture setup"
```

### Task 4: Implement the Real Codex Provider and Trace Capture

**Files:**
- Modify: `crates/but/skill/e2e/providers/codex-integration.ts`
- Modify: `crates/but/skill/e2e/promptfooconfig.yaml`
- Create: `crates/but/skill/e2e/types.ts`
- Test: `crates/but/skill/e2e/providers/codex-integration.ts`

**Step 1: Write the failing provider contract**

The provider must:

- launch a real Codex session against the prepared repo
- pass the repo-local `.agents/skills/gitbutler`
- capture executed shell commands and final text output
- preserve per-scenario environment isolation
- write artifacts for debugging

**Step 2: Add a narrow smoke test for provider shape**

Create a minimal test or executable check that imports the provider and validates:

- it accepts scenario config
- it returns structured output containing transcript path, command trace, and repo path

**Step 3: Write minimal provider implementation**

Implement:

- scenario-specific env injection
- command trace recording
- artifact persistence
- cleanup in `finally` with best-effort semantics

Do not add multi-agent matrix support yet.

**Step 4: Run the provider smoke build**

Run: `pnpm --dir crates/but/skill/e2e build`

Expected: build succeeds with the real provider code present.

**Step 5: Commit**

```bash
git add crates/but/skill/e2e/providers/codex-integration.ts crates/but/skill/e2e/promptfooconfig.yaml crates/but/skill/e2e/types.ts
git commit -m "test: implement codex e2e provider"
```

### Task 5: Implement Shared Assertions for Trace and Repo Outcomes

**Files:**
- Modify: `crates/but/skill/e2e/assertions/codex-assertions.ts`
- Create: `crates/but/skill/e2e/assertions/__tests__/codex-assertions.test.ts`
- Test: `crates/but/skill/e2e/assertions/__tests__/codex-assertions.test.ts`

**Step 1: Write failing assertion tests**

Add tests for:

- `assertNoRawGitWrites(trace)`
- `assertCommandOrder(trace, first, second)`
- `assertCreatedParallelBranch(repoState, branchName)`
- `assertCreatedStackedBranch(repoState, branchName, anchor)`
- `assertAskedClarificationQuestion(output, text)`

**Step 2: Run the assertion tests to verify they fail**

Run: `pnpm --dir crates/but/skill/e2e test assertions`

Expected: failures due to missing implementations.

**Step 3: Write minimal assertion implementations**

Implement pure functions operating on:

- command trace arrays
- final repo state loaded from `but status --json`
- final transcript text

Keep assertion helpers deterministic and side-effect free.

**Step 4: Re-run the assertion tests**

Run: `pnpm --dir crates/but/skill/e2e test assertions`

Expected: all assertion tests pass.

**Step 5: Commit**

```bash
git add crates/but/skill/e2e/assertions
git commit -m "test: add codex e2e assertions"
```

### Task 6: Add Core Scenario 1 and 2 for Branch Type Choice

**Files:**
- Create: `crates/but/skill/e2e/scenarios/independent-branch-choice.yaml`
- Create: `crates/but/skill/e2e/scenarios/stacked-branch-choice.yaml`
- Modify: `crates/but/skill/e2e/promptfooconfig.yaml`
- Test: `crates/but/skill/e2e/scenarios/independent-branch-choice.yaml`
- Test: `crates/but/skill/e2e/scenarios/stacked-branch-choice.yaml`

**Step 1: Write the failing scenario definitions**

Scenario 1 expectations:

- start with a simple repo
- user asks for independent work
- agent uses `but branch new <name>`
- agent commits with `--changes` and `--status-after`

Scenario 2 expectations:

- start with a fixture where dependency branch already exists
- user asks for work that depends on that branch
- agent uses `but branch new <name> -a <anchor>`

**Step 2: Run the scenarios once to capture baseline failure**

Run: `pnpm --dir crates/but/skill/e2e eval --filter "independent-branch-choice|stacked-branch-choice"`

Expected: initial failure until scenario wiring and assertions are complete.

**Step 3: Wire the scenarios into the harness**

Each scenario should define:

- fixture name
- natural-language prompt
- expected branch behavior assertions
- expected repo-state post-check

**Step 4: Re-run both scenarios**

Run: `pnpm --dir crates/but/skill/e2e eval --filter "independent-branch-choice|stacked-branch-choice"`

Expected: both scenarios pass.

**Step 5: Commit**

```bash
git add crates/but/skill/e2e/scenarios crates/but/skill/e2e/promptfooconfig.yaml
git commit -m "test: add codex branch choice e2e scenarios"
```

### Task 7: Add Core Scenario 3 and 4 for Guardrail Behavior

**Files:**
- Create: `crates/but/skill/e2e/scenarios/ambiguous-branch-type-asks-first.yaml`
- Create: `crates/but/skill/e2e/scenarios/no-raw-git-writes.yaml`
- Modify: `crates/but/skill/e2e/promptfooconfig.yaml`
- Test: `crates/but/skill/e2e/scenarios/ambiguous-branch-type-asks-first.yaml`
- Test: `crates/but/skill/e2e/scenarios/no-raw-git-writes.yaml`

**Step 1: Write the failing scenario definitions**

Scenario 3 expectations:

- multi-stack fixture
- ambiguous user request
- agent asks the 3 clarification questions before mutation
- no branch creation or commit before the questions

Scenario 4 expectations:

- user speaks in raw git terms
- agent translates into `but` workflow
- no `git add`, `git commit`, `git push`, `git checkout` in trace

**Step 2: Run the scenarios once to verify failure**

Run: `pnpm --dir crates/but/skill/e2e eval --filter "ambiguous-branch-type-asks-first|no-raw-git-writes"`

Expected: initial failure or missing assertion errors.

**Step 3: Wire the scenarios and assertions**

Bind:

- transcript assertions for clarification questions
- trace assertions for no raw git writes
- repo assertions for mutation ordering where applicable

**Step 4: Re-run the scenarios**

Run: `pnpm --dir crates/but/skill/e2e eval --filter "ambiguous-branch-type-asks-first|no-raw-git-writes"`

Expected: both scenarios pass.

**Step 5: Commit**

```bash
git add crates/but/skill/e2e/scenarios crates/but/skill/e2e/promptfooconfig.yaml
git commit -m "test: add codex guardrail e2e scenarios"
```

### Task 8: Add High-Risk Follow-Up Scenarios

**Files:**
- Create: `crates/but/skill/e2e/scenarios/conflict-marker-hard-gate.yaml`
- Create: `crates/but/skill/e2e/scenarios/dependency-lock-recovery.yaml`
- Create: `crates/but/skill/e2e/scenarios/unapplied-anchor-visibility.yaml`
- Create: `crates/but/skill/e2e/scenarios/pick-target-ambiguity.yaml`
- Modify: `crates/but/skill/e2e/promptfooconfig.yaml`
- Test: `crates/but/skill/e2e/scenarios/*.yaml`

**Step 1: Write the failing scenario definitions**

Cover:

- unresolved markers blocking mutation
- post-commit consumption verification and dependency recovery
- unapplied anchor visibility before stacked creation
- `pick` target ambiguity in multi-stack workspaces

**Step 2: Run one high-risk scenario first**

Run: `pnpm --dir crates/but/skill/e2e eval --filter "conflict-marker-hard-gate"`

Expected: failure until assertions and fixture shaping are correct.

**Step 3: Implement the remaining scenarios incrementally**

Add one scenario at a time, ensuring each has:

- a fixture setup path
- trace assertions
- final repo assertions
- clear failure artifacts

**Step 4: Run the full scenario suite once**

Run: `pnpm --dir crates/but/skill/e2e eval`

Expected: all scenarios pass in a single-shot smoke run.

**Step 5: Commit**

```bash
git add crates/but/skill/e2e/scenarios crates/but/skill/e2e/promptfooconfig.yaml
git commit -m "test: add high-risk codex e2e scenarios"
```

### Task 9: Add a Release-CLI Update Preflight and Operator Workflow

**Files:**
- Modify: `crates/but/skill/e2e/README.md`
- Create: `docs/testing/gitbutler-skill-codex-e2e-runbook.md`
- Test: `docs/testing/gitbutler-skill-codex-e2e-runbook.md`

**Step 1: Write the failing operator checklist**

The runbook must cover:

- how to update the installed `but` CLI to latest
- how to confirm the `but` binary being used
- required Codex credentials/environment
- how to run one scenario
- how to run the smoke suite
- where artifacts are stored

**Step 2: Verify no such runbook exists**

Run: `test -f docs/testing/gitbutler-skill-codex-e2e-runbook.md`

Expected: non-zero exit status.

**Step 3: Write the runbook**

Include exact commands such as:

- checking `which but`
- checking `but --version`
- updating the installed CLI using the supported install path for the host machine
- invoking the e2e harness

Do not assume the operator has any prior context.

**Step 4: Review the README and runbook for path consistency**

Run: `rg -n "crates/but/skill/e2e|\\.agents/skills/gitbutler|but --version|which but" crates/but/skill/e2e/README.md docs/testing/gitbutler-skill-codex-e2e-runbook.md`

Expected: consistent matches across both docs.

**Step 5: Commit**

```bash
git add crates/but/skill/e2e/README.md docs/testing/gitbutler-skill-codex-e2e-runbook.md
git commit -m "docs: add codex e2e runbook"
```

### Task 10: Verification and Merge Readiness

**Files:**
- Modify: `crates/but/skill/README.md`
- Modify: `crates/but/skill/RESEARCH.md`
- Modify: `crates/but/skill/e2e/README.md`
- Test: `crates/but/skill/e2e`

**Step 1: Run the narrow smoke suite**

Run: `pnpm --dir crates/but/skill/e2e eval --filter "independent-branch-choice|stacked-branch-choice|ambiguous-branch-type-asks-first|no-raw-git-writes"`

Expected: all 4 core scenarios pass.

**Step 2: Run the full suite once**

Run: `pnpm --dir crates/but/skill/e2e eval`

Expected: all configured scenarios pass.

**Step 3: Run repeated evaluation for flake detection**

Run: `pnpm --dir crates/but/skill/e2e eval:repeat`

Expected: repeated runs complete without systematic failures; any flakes are documented before merge.

**Step 4: Review documentation and git diff**

Run: `git diff --stat`

Expected: only intended harness, docs, and scenario files are modified.

**Step 5: Commit**

```bash
git add crates/but/skill/README.md crates/but/skill/RESEARCH.md crates/but/skill/e2e docs/testing/gitbutler-skill-codex-e2e-runbook.md
git commit -m "test: add codex end-to-end skill evaluation"
```
