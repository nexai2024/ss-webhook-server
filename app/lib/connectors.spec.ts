import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeSaaSConnectors, type SaaSConnectorConfig } from "./connectors";

global.fetch = vi.fn();

describe("SaaS Connectors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should execute Google Sheets connector", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    const connectors: SaaSConnectorConfig[] = [
      {
        id: "c1",
        type: "google_sheets",
        name: "Google Sheets",
        enabled: true,
        targetUrl: "https://script.google.com/macros/s/test/exec",
      },
    ];

    const results = await executeSaaSConnectors(connectors, {
      body: '{"foo":"bar"}',
      headers: {},
      query: {},
      timestamp: new Date().toISOString(),
      slug: "test-slug",
    });

    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://script.google.com/macros/s/test/exec",
      expect.objectContaining({ method: "POST" })
    );
  });
});
