# GitButler Skill Guardrail Optimization Design

## Goal
Improve the built-in `but` skill workflow so agents handle complex multi-agent repositories more safely, especially around branch isolation decisions and mutation guardrails, while keeping user-installed skill payload focused (no test docs in installed `references/`).

## Context and Problem
Recent reports showed repeated failures in complex repositories:

- ambiguous branch-type decisions (parallel vs stacked)
- multi-applied-stack routing ambiguity
- command success without expected change consumption
- stale/visibility-sensitive CLI ID and anchor usage
- conflict marker contamination in shared workspace

The previous installed skill documented general usage well, but did not enforce explicit clarification before branch-type choice in unclear repository states.

## Design Decisions

### 1) Add an Isolation Decision Gate to installed skill
Add a mandatory decision section in `crates/but/skill/SKILL.md`:

- require user clarification before branch-type selection when dependency/ownership is unclear
- define three mandatory clarification questions:
  1. dependency on unmerged work
  2. overlap with other agent file ownership
  3. independent merge vs explicit stacked dependency
- block mutation until clarified

### 2) Add explicit mapping: isolation requirement -> branch type
In installed skill (`SKILL.md`):

- independent work -> parallel branch
- dependent work -> stacked branch
- existing branches requiring dependency -> `but branch move`
- unclear cases -> conservative mode

### 3) Strengthen complex-repo preflight guidance
In installed skill (`SKILL.md`):

- require `status` + `branch list` before mutation in multi-agent repos
- add conflict marker scan command as a pre-mutation hard gate

### 4) Add a user-facing example for ambiguous branch decisions
In installed examples (`crates/but/skill/references/examples.md`):

- introduce "Complex Repository Branch-Type Decision (Ask First)"
- demonstrate ask-first workflow and branch choice path

### 5) Keep tests out of installed skill payload
Because `but skill install` copies `SKILL.md` and `references/`, any file in `references/` is user-installed.

To honor product requirement, move regression test case documentation out of install payload:

- from: `crates/but/skill/references/guardrail_test_cases.md`
- to: `docs/testing/gitbutler-skill-guardrail-test-cases.md`

This preserves internal engineering guidance without shipping test docs to end users.

## Test Strategy (Repository, Not Installed Skill)
Regression behavior is validated by repository tests in `crates/but/tests`:

- `crates/but/tests/but/command/guardrail_workflow.rs`

Coverage includes:

- isolated parallel commits across branches
- conflicted-commit preflight detectability
- marker-scan detectability
- multi-stack risk flagging
- unapplied anchor visibility risk detection
- pick target visibility risk in multi-stack workspace

## Files Changed by This Design

Installed skill content:

- `crates/but/skill/SKILL.md`
- `crates/but/skill/references/examples.md`

Repository-only docs/tests:

- `docs/testing/gitbutler-skill-guardrail-test-cases.md`
- `crates/but/tests/but/command/guardrail_workflow.rs`
- `crates/but/tests/but/command/mod.rs`

## Non-Goals

- changing core `but` command semantics in this iteration
- adding interactive prompting logic into CLI runtime
- enforcing guardrails in binary behavior (this iteration focuses on skill workflow + regression coverage)

## Rollout Notes

- Users updating via `but skill install --detect` will receive workflow guardrail improvements.
- They will not receive internal test-case documentation because it now lives under `docs/testing`.
