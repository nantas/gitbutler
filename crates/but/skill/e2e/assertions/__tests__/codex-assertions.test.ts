import test from "node:test";
import assert from "node:assert/strict";

import {
  assertAskedClarificationQuestion,
  assertBranchHasCommitMessage,
  assertCommandOrder,
  assertCreatedParallelBranch,
  assertCreatedStackedBranch,
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
