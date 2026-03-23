export interface CodexProviderResult {
  output: string;
  metadata: Record<string, string>;
}

export default async function callApi(): Promise<CodexProviderResult> {
  return {
    output: "placeholder",
    metadata: {
      status: "not-implemented"
    }
  };
}
