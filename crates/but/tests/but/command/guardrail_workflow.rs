use anyhow::Context as _;
use serde_json::Value;

use super::util::enter_edit_mode_with_conflicted_commit;
use crate::utils::{CommandExt as _, Sandbox};

fn status_json(env: &Sandbox) -> anyhow::Result<Value> {
    let output = env.but("--json status").allow_json().output()?;
    serde_json::from_slice(&output.stdout).context("status output should be valid JSON")
}

fn branch_cli_id(status: &Value, branch_name: &str) -> anyhow::Result<String> {
    status["stacks"]
        .as_array()
        .context("status.stacks should be an array")?
        .iter()
        .flat_map(|stack| stack["branches"].as_array().into_iter().flatten())
        .find(|branch| branch["name"].as_str() == Some(branch_name))
        .and_then(|branch| branch["cliId"].as_str())
        .map(ToOwned::to_owned)
        .context("expected branch cli id in status output")
}

fn unassigned_file_cli_id(status: &Value, file_path: &str) -> anyhow::Result<String> {
    status["unassignedChanges"]
        .as_array()
        .context("status.unassignedChanges should be an array")?
        .iter()
        .find(|change| change["filePath"].as_str() == Some(file_path))
        .and_then(|change| change["cliId"].as_str())
        .map(ToOwned::to_owned)
        .context("expected unassigned file cli id in status output")
}

fn stack_count(status: &Value) -> anyhow::Result<usize> {
    Ok(status["stacks"]
        .as_array()
        .context("status.stacks should be an array")?
        .len())
}

fn has_branch(status: &Value, branch_name: &str) -> anyhow::Result<bool> {
    let found = status["stacks"]
        .as_array()
        .context("status.stacks should be an array")?
        .iter()
        .flat_map(|stack| stack["branches"].as_array().into_iter().flatten())
        .any(|branch| branch["name"].as_str() == Some(branch_name));
    Ok(found)
}

fn branch_has_commit_message(
    status: &Value,
    branch_name: &str,
    message_contains: &str,
) -> anyhow::Result<bool> {
    let found = status["stacks"]
        .as_array()
        .context("status.stacks should be an array")?
        .iter()
        .flat_map(|stack| stack["branches"].as_array().into_iter().flatten())
        .filter(|branch| branch["name"].as_str() == Some(branch_name))
        .flat_map(|branch| branch["commits"].as_array().into_iter().flatten())
        .any(|commit| {
            commit["message"]
                .as_str()
                .map(|m| m.contains(message_contains))
                .unwrap_or(false)
        });
    Ok(found)
}

fn should_block_mutation_for_multi_stack(status: &Value) -> anyhow::Result<bool> {
    Ok(stack_count(status)? > 2)
}

fn should_block_pick_for_visibility_risk(status: &Value, target_branch: &str) -> anyhow::Result<bool> {
    let stacks = stack_count(status)?;
    let target_visible = has_branch(status, target_branch)?;
    Ok(stacks > 1 && target_visible)
}

#[test]
fn multi_agent_parallel_changes_can_be_committed_isolated_per_branch() -> anyhow::Result<()> {
    let env = Sandbox::init_scenario_with_target_and_default_settings("two-stacks")?;
    env.setup_metadata(&["A", "B"])?;

    // Simulate two agents modifying different files in the same repository workspace.
    env.file("agent-a-notes.md", "Agent A update\n");
    env.file("agent-b-notes.md", "Agent B update\n");

    let status = status_json(&env)?;
    let branch_a = branch_cli_id(&status, "A")?;
    let branch_b = branch_cli_id(&status, "B")?;
    let file_a = unassigned_file_cli_id(&status, "agent-a-notes.md")?;
    let file_b = unassigned_file_cli_id(&status, "agent-b-notes.md")?;

    env.but(format!(
        "commit {branch_a} -m 'docs: agent-a isolated update' --changes {file_a} --status-after"
    ))
    .assert()
    .success();
    env.but(format!(
        "commit {branch_b} -m 'docs: agent-b isolated update' --changes {file_b} --status-after"
    ))
    .assert()
    .success();

    let status_after = status_json(&env)?;
    assert!(
        status_after["unassignedChanges"]
            .as_array()
            .is_some_and(|arr| arr.is_empty()),
        "expected no unassigned changes after isolated commits"
    );
    assert!(
        branch_has_commit_message(&status_after, "A", "agent-a isolated update")?,
        "expected branch A to contain agent A commit"
    );
    assert!(
        branch_has_commit_message(&status_after, "B", "agent-b isolated update")?,
        "expected branch B to contain agent B commit"
    );

    Ok(())
}

#[test]
fn guardrail_preflight_can_detect_conflicted_commits_in_target_branch() -> anyhow::Result<()> {
    let env = Sandbox::init_scenario_with_target_and_default_settings("one-stack")?;
    env.setup_metadata(&["A"])?;

    // Reuse existing helper that creates an edit-mode conflicted commit.
    enter_edit_mode_with_conflicted_commit(&env)?;
    env.but("resolve cancel --force").assert().success();

    let status = status_json(&env)?;
    let has_conflicted = status["stacks"]
        .as_array()
        .context("status.stacks should be an array")?
        .iter()
        .flat_map(|stack| stack["branches"].as_array().into_iter().flatten())
        .flat_map(|branch| branch["commits"].as_array().into_iter().flatten())
        .any(|commit| commit["conflicted"].as_bool() == Some(true));

    assert!(
        has_conflicted,
        "expected preflight to observe at least one conflicted commit in status output"
    );

    Ok(())
}

#[test]
fn marker_scan_gate_can_detect_unresolved_merge_markers() -> anyhow::Result<()> {
    let env = Sandbox::init_scenario_with_target_and_default_settings("one-stack")?;
    env.setup_metadata(&["A"])?;

    env.file(
        "docs/needs-resolution.md",
        "<<<<<<< ours\nleft\n=======\nright\n>>>>>>> theirs\n",
    );

    let content = std::fs::read_to_string(env.projects_root().join("docs/needs-resolution.md"))?;
    let has_markers = content.lines().any(|line| {
        line.starts_with("<<<<<<<")
            || line == "======="
            || line.starts_with(">>>>>>>")
            || line.starts_with("|||||||")
    });

    assert!(
        has_markers,
        "expected guardrail marker scan to detect unresolved conflict markers"
    );
    Ok(())
}

#[test]
fn guardrail_preflight_flags_when_applied_stacks_exceed_two() -> anyhow::Result<()> {
    let env = Sandbox::init_scenario_with_target_and_default_settings("two-stacks")?;
    env.setup_metadata(&["A", "B"])?;

    // Add a third applied stack to simulate multi-agent contention.
    env.invoke_bash(
        r#"
git checkout main -b C
git commit -m 'add C' --allow-empty
git checkout gitbutler/workspace
"#,
    );
    env.but("apply C").assert().success();

    let status = status_json(&env)?;
    assert_eq!(stack_count(&status)?, 3, "expected three applied stacks");
    assert!(
        should_block_mutation_for_multi_stack(&status)?,
        "expected guardrail to block mutations when more than two stacks are applied"
    );
    Ok(())
}

#[test]
fn guardrail_detects_unapplied_anchor_before_stacked_branch_creation() -> anyhow::Result<()> {
    let env = Sandbox::init_scenario_with_target_and_default_settings("one-stack")?;
    env.setup_metadata(&["A"])?;

    // Create anchor branch that exists in git refs but is not applied in workspace.
    env.invoke_bash(
        r#"
git checkout main -b anchor-unapplied
git commit -m 'anchor commit' --allow-empty
git checkout gitbutler/workspace
"#,
    );

    let status_before = status_json(&env)?;
    assert!(
        !has_branch(&status_before, "anchor-unapplied")?,
        "anchor branch should not be visible in applied workspace before apply"
    );

    // Guardrail should require apply/visibility before attempting `branch new -a`.
    let should_block = !has_branch(&status_before, "anchor-unapplied")?;
    assert!(
        should_block,
        "expected guardrail to block stacked creation with unapplied anchor"
    );

    env.but("apply anchor-unapplied").assert().success();
    let status_after = status_json(&env)?;
    assert!(
        has_branch(&status_after, "anchor-unapplied")?,
        "anchor should become visible after apply"
    );
    Ok(())
}

#[test]
fn guardrail_flags_pick_target_risk_in_multi_stack_workspace() -> anyhow::Result<()> {
    let env = Sandbox::init_scenario_with_target_and_default_settings("pick-from-unapplied")?;
    env.setup_metadata(&["applied-branch"])?;

    // Add another applied branch so pick target selection becomes riskier.
    env.invoke_bash(
        r#"
git checkout main -b another-applied
git commit -m 'another applied branch' --allow-empty
git checkout gitbutler/workspace
"#,
    );
    env.but("apply another-applied").assert().success();

    let status = status_json(&env)?;
    assert!(
        should_block_pick_for_visibility_risk(&status, "applied-branch")?,
        "expected guardrail to flag pick target visibility risk in multi-stack workspace"
    );
    Ok(())
}
