import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ApiProvider, CallApiContextParams, CallApiOptionsParams, ProviderOptions, ProviderResponse } from "promptfoo";

import type { CodexCommandTrace, CodexJsonEvent, CodexProviderMetadata, FixtureSetupResult } from "../types.js";

const defaultBasePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const preferredButPath = path.join(homedir(), ".local", "bin", "but");

function resolveButBinary(config: Record<string, unknown>): string {
  const configured = typeof config.butBin === "string" ? config.butBin.trim() : "";
  if (configured) {
    return configured;
  }

  return preferredButPath;
}

function buildCommandEnv(butBinary: string): NodeJS.ProcessEnv {
  const butDir = path.dirname(butBinary);
  return {
    ...process.env,
    BUT_BIN: butBinary,
    PATH: `${butDir}${path.delimiter}${process.env.PATH ?? ""}`
  };
}

function parseFixtureSetup(raw: string): FixtureSetupResult {
  return JSON.parse(raw) as FixtureSetupResult;
}

export function parseCodexJsonl(stdout: string): { lastMessage: string; trace: CodexCommandTrace[] } {
  const trace: CodexCommandTrace[] = [];
  let lastMessage = "";

  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const event = JSON.parse(trimmed) as CodexJsonEvent;
    if (event.type === "item.completed" && event.item?.type === "agent_message" && event.item.text) {
      lastMessage = event.item.text;
    }

    if (
      event.type === "item.completed" &&
      event.item?.type === "command_execution" &&
      typeof event.item.command === "string" &&
      typeof event.item.aggregated_output === "string" &&
      typeof event.item.exit_code === "number"
    ) {
      trace.push({
        command: event.item.command,
        output: event.item.aggregated_output,
        exitCode: event.item.exit_code
      });
    }
  }

  return { lastMessage, trace };
}

function runFixtureSetup(basePath: string, fixtureName: string, env: NodeJS.ProcessEnv): FixtureSetupResult {
  const scriptPath = path.join(basePath, "setup-fixture.sh");
  const raw = execFileSync(scriptPath, [fixtureName], {
    cwd: basePath,
    encoding: "utf8",
    env
  });
  return parseFixtureSetup(raw);
}

function runButStatus(repoPath: string, butBinary: string, env: NodeJS.ProcessEnv): unknown {
  const result = spawnSync(butBinary, ["--json", "status"], {
    cwd: repoPath,
    encoding: "utf8",
    env
  });

  if (result.status !== 0) {
    throw new Error(`but --json status failed: ${result.stderr || result.stdout}`);
  }

  return JSON.parse(result.stdout);
}

function writePromptArtifact(artifactPath: string, prompt: string): string {
  const promptPath = path.join(artifactPath, "prompt.txt");
  writeFileSync(promptPath, prompt);
  return promptPath;
}

function buildCodexArgs(repoPath: string, transcriptPath: string, prompt: string, model?: string): string[] {
  const args = ["--ask-for-approval", "never", "exec", "--json", "--output-last-message", transcriptPath, "-C", repoPath, "-s", "workspace-write"];
  if (model) {
    args.push("--model", model);
  }
  args.push(prompt);
  return args;
}

export default class CodexIntegrationProvider implements ApiProvider {
  private readonly providerId: string;
  readonly config: Record<string, unknown>;

  constructor(options: ProviderOptions) {
    this.providerId = options.id ?? "file://dist/providers/codex-integration.js";
    this.config = options.config ?? {};
  }

  id(): string {
    return this.providerId;
  }

  async callApi(prompt: string, context?: CallApiContextParams, _options?: CallApiOptionsParams): Promise<ProviderResponse> {
    const fixtureName = String(context?.vars?.fixture ?? "");
    if (!fixtureName) {
      return {
        error: "Missing required fixture variable",
        output: ""
      };
    }

    const configuredBasePath =
      typeof this.config.basePath === "string" && this.config.basePath.trim().length > 0 ? this.config.basePath : undefined;
    const basePath = configuredBasePath
      ? path.resolve(path.isAbsolute(configuredBasePath) ? configuredBasePath : path.join(defaultBasePath, configuredBasePath))
      : defaultBasePath;
    const butBinary = resolveButBinary(this.config);
    const commandEnv = buildCommandEnv(butBinary);
    const fixture = runFixtureSetup(basePath, fixtureName, commandEnv);
    const artifactPath = fixture.artifactPath;
    mkdirSync(artifactPath, { recursive: true });

    const promptPath = writePromptArtifact(artifactPath, prompt);
    const transcriptPath = path.join(artifactPath, "last-message.txt");
    const eventLogPath = path.join(artifactPath, "codex-events.jsonl");
    const scenarioLogPath = path.join(artifactPath, "scenario.log");

    const codexArgs = buildCodexArgs(
      fixture.repoPath,
      transcriptPath,
      readFileSync(promptPath, "utf8"),
      typeof this.config.model === "string" ? this.config.model : undefined
    );

    const codexResult = spawnSync("codex", codexArgs, {
      cwd: fixture.repoPath,
      encoding: "utf8",
      env: commandEnv
    });

    writeFileSync(eventLogPath, codexResult.stdout ?? "");

    if (codexResult.status !== 0) {
      return {
        error: codexResult.stderr || `codex exited with status ${codexResult.status}`,
        output: "",
        metadata: {
          repoPath: fixture.repoPath,
          artifactPath,
          skillPath: fixture.skillPath,
          transcriptPath,
          eventLogPath,
          scenarioLogPath
        }
      };
    }

    const parsed = parseCodexJsonl(codexResult.stdout ?? "");
    const repoState = runButStatus(fixture.repoPath, butBinary, commandEnv);
    const lastMessage = readFileSync(transcriptPath, "utf8").trim() || parsed.lastMessage;
    const metadata: CodexProviderMetadata = {
      repoPath: fixture.repoPath,
      artifactPath,
      skillPath: fixture.skillPath,
      transcriptPath,
      eventLogPath,
      scenarioLogPath,
      trace: parsed.trace,
      repoState
    };

    return {
      output: lastMessage,
      raw: {
        promptPath,
        stdout: codexResult.stdout
      },
      metadata
    };
  }
}
