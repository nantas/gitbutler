import type { CodexCommandTrace, CodexProviderMetadata } from "../types.js";

function metadataFromContext(context: { providerResponse?: { metadata?: unknown } }): CodexProviderMetadata {
  const metadata = context.providerResponse?.metadata;
  if (!metadata || typeof metadata !== "object") {
    throw new Error("Missing provider metadata");
  }
  return metadata as CodexProviderMetadata;
}

function traceCommands(trace: CodexCommandTrace[]): string[] {
  return trace.map((item) => item.command);
}

function traceOutputs(trace: CodexCommandTrace[]): string[] {
  return trace.map((item) => item.output);
}

function flattenBranches(repoState: any): any[] {
  return (repoState?.stacks ?? []).flatMap((stack: any) => stack.branches ?? []);
}

function isMutationCommand(command: string): boolean {
  return /\bbut (branch new|branch move|commit|stage|rub|amend|move|squash|absorb|pick|resolve|push|pull)\b/.test(command)
    || /\bgit (add|commit|push|checkout|merge|rebase|stash|cherry-pick)\b/.test(command);
}

export function assertPlaceholder(): boolean {
  return true;
}

export function assertNoRawGitWrites(_output: string, context: any): boolean {
  const commands = traceCommands(metadataFromContext(context).trace);
  return commands.every((command) => !/git (add|commit|push|checkout|merge|rebase|stash|cherry-pick)\b/.test(command));
}

export function assertNoMutationCommands(_output: string, context: any): boolean {
  const commands = traceCommands(metadataFromContext(context).trace);
  return commands.every((command) => !isMutationCommand(command));
}

export function assertCommandOrder(
  _output: string,
  context: { vars?: Record<string, unknown>; providerResponse?: { metadata?: unknown } }
): boolean {
  const expectedFirst = String(context.vars?.expected_first_command ?? "");
  const expectedSecond = String(context.vars?.expected_second_command ?? "");
  const commands = traceCommands(metadataFromContext(context).trace);
  const firstIndex = commands.findIndex((command) => command.includes(expectedFirst));
  const secondIndex = commands.findIndex((command) => command.includes(expectedSecond));
  return firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex;
}

export function assertCreatedParallelBranch(
  _output: string,
  context: { vars?: Record<string, unknown>; providerResponse?: { metadata?: unknown } }
): boolean {
  const branchName = String(context.vars?.expected_branch_name ?? "");
  return flattenBranches(metadataFromContext(context).repoState).some((branch) => branch.name === branchName);
}

export function assertUsedStackedBranchCreation(
  _output: string,
  context: { vars?: Record<string, unknown>; providerResponse?: { metadata?: unknown } }
): boolean {
  const branchName = String(context.vars?.expected_branch_name ?? "");
  const commands = traceCommands(metadataFromContext(context).trace);
  return commands.some((command) => command.includes(`branch new ${branchName}`) && command.includes("-a "));
}

export function assertAppliedAnchorBeforeStackedCreation(
  _output: string,
  context: { vars?: Record<string, unknown>; providerResponse?: { metadata?: unknown } }
): boolean {
  const branchName = String(context.vars?.expected_branch_name ?? "");
  const anchorName = String(context.vars?.expected_anchor_name ?? "");
  const commands = traceCommands(metadataFromContext(context).trace);
  const applyIndex = commands.findIndex((command) => command.includes(`apply ${anchorName}`));
  const stackedIndex = commands.findIndex(
    (command, index) => index > applyIndex && command.includes(`branch new ${branchName}`) && command.includes("-a ")
  );
  return applyIndex >= 0 && stackedIndex > applyIndex;
}

export function assertCreatedStackedBranch(
  _output: string,
  context: { vars?: Record<string, unknown>; providerResponse?: { metadata?: unknown } }
): boolean {
  const branchName = String(context.vars?.expected_branch_name ?? "");
  const anchorName = String(context.vars?.expected_anchor_name ?? "");
  const metadata = metadataFromContext(context);
  const commands = traceCommands(metadata.trace);
  const created = commands.some((command) => command.includes(`branch new ${branchName}`) && command.includes("-a "));
  const stack = (metadata.repoState as any)?.stacks?.find((candidate: any) =>
    (candidate?.branches ?? []).some((branch: any) => branch.name === branchName)
  );

  if (!created || !stack) {
    return false;
  }

  const branches = stack.branches ?? [];
  const branchIndex = branches.findIndex((branch: any) => branch.name === branchName);
  const anchorIndex = branches.findIndex((branch: any) => branch.name === anchorName);
  return branchIndex >= 0 && anchorIndex >= 0 && branchIndex < anchorIndex;
}

export function assertAskedClarificationQuestion(output: string, context: { vars?: Record<string, unknown> }): boolean {
  const question = String(context.vars?.expected_question_text ?? "");
  return output.includes(question);
}

export function assertAskedPickTargetClarification(output: string): boolean {
  const normalized = output.toLowerCase();
  return normalized.includes("target branch")
    && normalized.includes("receive")
    && normalized.includes("pick")
    && normalized.includes("commit")
    && normalized.includes("?");
}

export function assertAskedAllClarificationQuestions(output: string): boolean {
  return [
    "Does this task depend on unmerged work from `main` or another branch?",
    "Are the files likely shared with another agent's ongoing task?",
    "Should this task merge independently, or explicitly build on top of another branch?"
  ].every((question) => output.includes(question));
}

export function assertBranchHasCommitMessage(
  _output: string,
  context: { vars?: Record<string, unknown>; providerResponse?: { metadata?: unknown } }
): boolean {
  const branchName = String(context.vars?.expected_branch_name ?? "");
  const commitMessage = String(context.vars?.expected_commit_message ?? "");
  return flattenBranches(metadataFromContext(context).repoState)
    .filter((branch) => branch.name === branchName)
    .flatMap((branch) => branch.commits ?? [])
    .some((commit) => String(commit.message ?? "").includes(commitMessage));
}

export function assertRanConflictMarkerScan(_output: string, context: any): boolean {
  const commands = traceCommands(metadataFromContext(context).trace);
  return commands.some((command) =>
    command.includes("rg -n")
      && (command.includes("<<<<<<<") || command.includes("=======") || command.includes(">>>>>>>"))
  );
}

export function assertDependencyLockRecoveryFlow(
  _output: string,
  context: { vars?: Record<string, unknown>; providerResponse?: { metadata?: unknown } }
): boolean {
  const branchName = String(context.vars?.expected_branch_name ?? "");
  const dependencyBranchName = String(context.vars?.expected_dependency_branch_name ?? "");
  const metadata = metadataFromContext(context);
  const commands = traceCommands(metadata.trace);
  const outputs = traceOutputs(metadata.trace);

  const firstCommitIndex = commands.findIndex((command) =>
    command.includes(`but commit ${branchName}`) && command.includes("attempt before stacking")
  );
  const branchMoveIndex = commands.findIndex((command) =>
    command.includes(`but branch move ${branchName} ${dependencyBranchName}`)
  );
  const secondCommitIndex = commands.findIndex(
    (command, index) => index > branchMoveIndex && command.includes(`but commit ${branchName}`) && command.includes("commit after stacking")
  );

  const sawLockWarning = outputs.some((output) => output.includes("Some selected changes could not be committed."));
  const sawNoChangesCommit = outputs.some((output) => output.includes("attempt before stacking (no changes)"));

  return firstCommitIndex >= 0
    && branchMoveIndex > firstCommitIndex
    && secondCommitIndex > branchMoveIndex
    && sawLockWarning
    && sawNoChangesCommit;
}
