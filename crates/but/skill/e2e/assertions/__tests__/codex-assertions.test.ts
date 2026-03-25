import test from "node:test";
import assert from "node:assert/strict";

import {
  assertAskedAllClarificationQuestions,
  assertAskedClarificationQuestion,
  assertAppliedAnchorBeforeStackedCreation,
  assertBranchHasCommitMessage,
  assertCommandOrder,
  assertCreatedParallelBranch,
  assertCreatedStackedBranch,
  assertDependencyLockRecoveryFlow,
  assertAskedPickTargetClarification,
  assertRanConflictMarkerScan,
  assertUsedStackedBranchCreation,
  assertNoMutationCommands,
  assertNoRawGitWrites
} from "../codex-assertions.js";

const providerResponse = {
  metadata: {
    trace: [
      { command: "/bin/zsh -lc but status -fv", output: "", exitCode: 0 },
      { command: "/bin/zsh -lc but branch new feature-1", output: "", exitCode: 0 },
      { command: "/bin/zsh -lc but commit feature-1 -m 'msg' --changes a1 --status-after", output: "", exitCode: 0 }
    ],
    repoState: {
      stacks: [
        {
          branches: [
            {
              name: "feature-1",
              commits: [{ message: "msg" }]
            },
            {
              name: "feature-stacked",
              commits: [{ message: "stacked msg" }]
            }
          ]
        }
      ]
    }
  }
};

test("assertNoRawGitWrites rejects raw git writes", () => {
  const result = assertNoRawGitWrites("", {
    providerResponse: {
      metadata: {
        trace: [{ command: "/bin/zsh -lc git commit -m test", output: "", exitCode: 0 }],
        repoState: { stacks: [] }
      }
    }
  });
  assert.equal(result, false);
});

test("assertCommandOrder validates command sequence", () => {
  assert.equal(
    assertCommandOrder("", {
      vars: {
        expected_first_command: "but status -fv",
        expected_second_command: "but branch new feature-1"
      },
      providerResponse
    }),
    true
  );
});

test("assertCreatedParallelBranch validates branch presence", () => {
  assert.equal(
    assertCreatedParallelBranch("", {
      vars: { expected_branch_name: "feature-1" },
      providerResponse
    }),
    true
  );
});

test("assertCreatedStackedBranch validates stacked creation", () => {
  const stackedProvider = {
    metadata: {
      trace: [{ command: "/bin/zsh -lc but branch new feature-stacked -a g0", output: "", exitCode: 0 }],
      repoState: {
        stacks: [
          {
            branches: [
              {
                name: "feature-stacked",
                commits: [{ message: "stacked msg" }]
              },
              {
                name: "A",
                commits: [{ message: "anchor msg" }]
              }
            ]
          }
        ]
      }
    }
  };
  assert.equal(
    assertCreatedStackedBranch("", {
      vars: {
        expected_branch_name: "feature-stacked",
        expected_anchor_name: "A"
      },
      providerResponse: stackedProvider
    }),
    true
  );
});

test("assertUsedStackedBranchCreation validates stacked branch command usage", () => {
  assert.equal(
    assertUsedStackedBranchCreation("", {
      vars: {
        expected_branch_name: "feature-stacked"
      },
      providerResponse: {
        metadata: {
          trace: [{ command: "/bin/zsh -lc but branch new feature-stacked -a g0", output: "", exitCode: 0 }],
          repoState: { stacks: [] }
        }
      }
    }),
    true
  );
});

test("assertAppliedAnchorBeforeStackedCreation validates recovery flow", () => {
  assert.equal(
    assertAppliedAnchorBeforeStackedCreation("", {
      vars: {
        expected_branch_name: "feature-stacked",
        expected_anchor_name: "A"
      },
      providerResponse: {
        metadata: {
          trace: [
            { command: "/bin/zsh -lc but branch new feature-stacked -a A", output: "", exitCode: 1 },
            { command: "/bin/zsh -lc but apply A --status-after", output: "", exitCode: 0 },
            { command: "/bin/zsh -lc but branch new feature-stacked -a g0 --status-after", output: "", exitCode: 0 }
          ],
          repoState: { stacks: [] }
        }
      }
    }),
    true
  );
});

test("assertAskedClarificationQuestion finds prompt text", () => {
  assert.equal(
    assertAskedClarificationQuestion("Does this task depend on unmerged work from main or another branch?", {
      vars: {
        expected_question_text: "Does this task depend on unmerged work from main or another branch?"
      }
    }),
    true
  );
});

test("assertAskedAllClarificationQuestions validates the full question set", () => {
  assert.equal(
    assertAskedAllClarificationQuestions(
      "1. Does this task depend on unmerged work from `main` or another branch?\n"
        + "2. Are the files likely shared with another agent's ongoing task?\n"
        + "3. Should this task merge independently, or explicitly build on top of another branch?"
    ),
    true
  );
});

test("assertNoMutationCommands rejects but mutation commands", () => {
  assert.equal(
    assertNoMutationCommands("", {
      providerResponse: {
        metadata: {
          trace: [{ command: "/bin/zsh -lc but branch new feature-1", output: "", exitCode: 0 }],
          repoState: { stacks: [] }
        }
      }
    }),
    false
  );
});

test("assertBranchHasCommitMessage validates commit placement", () => {
  assert.equal(
    assertBranchHasCommitMessage("", {
      vars: {
        expected_branch_name: "feature-1",
        expected_commit_message: "msg"
      },
      providerResponse
    }),
    true
  );
});

test("assertRanConflictMarkerScan validates unresolved marker scan", () => {
  assert.equal(
    assertRanConflictMarkerScan("", {
      providerResponse: {
        metadata: {
          trace: [
            {
              command: "/bin/zsh -lc rg -n -e '^(<<<<<<<|=======|>>>>>>>|\\\\|\\\\|\\\\|\\\\|\\\\|\\\\|\\\\|)' docs/conflicted-notes.md",
              output: "1:<<<<<<< ours",
              exitCode: 0
            }
          ],
          repoState: { stacks: [] }
        }
      }
    }),
    true
  );
});

test("assertDependencyLockRecoveryFlow validates branch move recovery after a locked commit", () => {
  assert.equal(
    assertDependencyLockRecoveryFlow("", {
      vars: {
        expected_branch_name: "feature-recovery",
        expected_dependency_branch_name: "dependency-base"
      },
      providerResponse: {
        metadata: {
          trace: [
            {
              command: "/bin/zsh -lc but commit feature-recovery -m 'attempt before stacking' --changes uz --status-after",
              output: "Warning: Some selected changes could not be committed.\nattempt before stacking (no changes)",
              exitCode: 0
            },
            {
              command: "/bin/zsh -lc but branch move feature-recovery dependency-base --status-after",
              output: "Moved branch 'feature-recovery' on top of 'dependency-base'.",
              exitCode: 0
            },
            {
              command: "/bin/zsh -lc but commit feature-recovery -m 'commit after stacking' --changes uz --status-after",
              output: "Created commit 123 on branch feature-recovery",
              exitCode: 0
            }
          ],
          repoState: { stacks: [] }
        }
      }
    }),
    true
  );
});

test("assertAskedPickTargetClarification accepts direct pick-target questions", () => {
  assert.equal(
    assertAskedPickTargetClarification("Which target branch should receive the picked commit from `unapplied-branch`?"),
    true
  );
});

test("assertAskedPickTargetClarification accepts reordered pick phrasing", () => {
  assert.equal(
    assertAskedPickTargetClarification("Which target branch should receive the commit picked from `unapplied-branch`?"),
    true
  );
});
