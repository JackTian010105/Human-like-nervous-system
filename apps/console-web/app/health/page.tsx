import type { HealthResponse } from "@command-neural/shared-types";

export default function HealthPage() {
  const sample: HealthResponse = { status: "ok" };

  return (
    <main style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>Console Health</h1>
      <pre>{JSON.stringify(sample, null, 2)}</pre>
    </main>
  );
}
