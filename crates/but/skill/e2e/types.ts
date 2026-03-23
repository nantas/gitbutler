export interface CodexCommandTrace {
  command: string;
  output: string;
  exitCode: number;
}

export interface FixtureSetupResult {
  scenario: string;
  repoPath: string;
  artifactPath: string;
  skillPath: string;
}

export interface CodexProviderMetadata {
  repoPath: string;
  artifactPath: string;
  skillPath: string;
  transcriptPath: string;
  eventLogPath: string;
  scenarioLogPath: string;
  trace: CodexCommandTrace[];
  repoState: unknown;
}

export interface CodexJsonEvent {
  type: string;
  item?: {
    type?: string;
    text?: string;
    command?: string;
    aggregated_output?: string;
    exit_code?: number | null;
    status?: string;
  };
  message?: string;
}
