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

function flattenBranches(repoState: any): any[] {
  return (repoState?.stacks ?? []).flatMap((stack: any) => stack.branches ?? []);
}

export function assertPlaceholder(): boolean {
  return true;
}

export function assertNoRawGitWrites(_output: string, context: any): boolean {
  const commands = traceCommands(metadataFromContext(context).trace);
  return commands.every((command) => !/git (add|commit|push|checkout|merge|rebase|stash|cherry-pick)\b/.test(command));
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
