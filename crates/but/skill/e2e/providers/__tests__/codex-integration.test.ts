import test from "node:test";
import assert from "node:assert/strict";

import { parseCodexJsonl } from "../codex-integration.js";

test("parseCodexJsonl extracts command traces and last message", () => {
  const jsonl = [
    JSON.stringify({ type: "thread.started", thread_id: "abc" }),
    JSON.stringify({
      type: "item.completed",
      item: {
        type: "agent_message",
        text: "Running pwd"
      }
    }),
    JSON.stringify({
      type: "item.completed",
      item: {
        type: "command_execution",
        command: "/bin/zsh -lc pwd",
        aggregated_output: "/tmp\n",
        exit_code: 0,
        status: "completed"
      }
    }),
    JSON.stringify({
      type: "item.completed",
      item: {
        type: "agent_message",
        text: "ok"
      }
    })
  ].join("\n");

  const parsed = parseCodexJsonl(jsonl);
  assert.equal(parsed.lastMessage, "ok");
  assert.deepEqual(parsed.trace, [
    {
      command: "/bin/zsh -lc pwd",
      output: "/tmp\n",
      exitCode: 0
    }
  ]);
});
