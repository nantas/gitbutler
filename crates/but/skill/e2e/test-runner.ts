import { spawnSync } from "node:child_process";

const scope = process.argv[2] ?? "all";
const tests =
  scope === "assertions"
    ? ["dist/assertions/__tests__/codex-assertions.test.js"]
    : scope === "providers"
      ? ["dist/providers/__tests__/codex-integration.test.js"]
      : [
          "dist/assertions/__tests__/codex-assertions.test.js",
          "dist/providers/__tests__/codex-integration.test.js"
        ];

const result = spawnSync(process.execPath, ["--test", ...tests], {
  stdio: "inherit"
});

process.exit(result.status ?? 1);
