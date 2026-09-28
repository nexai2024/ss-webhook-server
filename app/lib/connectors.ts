export interface SaaSConnectorConfig {
  id: string;
  type: "google_sheets" | "notion" | "airtable" | "webhook";
  name: string;
  enabled: boolean;
  targetUrl?: string; // App Script URL for Google Sheets, or Webhook URL
  apiKey?: string;    // Notion API Key, Airtable API Key
  databaseId?: string; // Notion Database ID, Airtable Base/Table ID
}

export interface ConnectorExecutionResult {
  connectorId: string;
  type: string;
  success: boolean;
  error?: string;
  status?: number;
}

/**
 * Execute 3rd-Party SaaS Connectors based on configured action rules
 */
export async function executeSaaSConnectors(
  connectors: SaaSConnectorConfig[],
  payload: {
    body: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    timestamp: string;
    slug: string;
  }
): Promise<ConnectorExecutionResult[]> {
  const activeConnectors = connectors.filter((c) => c.enabled);
  if (activeConnectors.length === 0) return [];

  const results: ConnectorExecutionResult[] = [];

  let parsedBody: any = payload.body;
  try {
    parsedBody = JSON.parse(payload.body);
  } catch {
    // Keep raw string if non-JSON
  }

  for (const connector of activeConnectors) {
    try {
      if (connector.type === "google_sheets" || connector.type === "webhook") {
        if (!connector.targetUrl) {
          results.push({
            connectorId: connector.id,
            type: connector.type,
            success: false,
            error: "Missing Target URL",
          });
          continue;
        }

        const res = await fetch(connector.targetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timestamp: payload.timestamp,
            slug: payload.slug,
            data: parsedBody,
            query: payload.query,
          }),
          signal: AbortSignal.timeout(5000),
        });

        results.push({
          connectorId: connector.id,
          type: connector.type,
          success: res.ok,
          status: res.status,
          error: res.ok ? undefined : `Status ${res.status}`,
        });
      } else if (connector.type === "notion") {
        if (!connector.apiKey || !connector.databaseId) {
          results.push({
            connectorId: connector.id,
            type: connector.type,
            success: false,
            error: "Missing Notion API key or Database ID",
          });
          continue;
        }

        // Send to Notion API
        const titleText = typeof parsedBody === "object" && parsedBody?.event ? String(parsedBody.event) : `Webhook ${payload.slug}`;
        const res = await fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${connector.apiKey}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
          },
          body: JSON.stringify({
            parent: { database_id: connector.databaseId },
            properties: {
              Name: {
                title: [{ text: { content: titleText } }],
              },
              Payload: {
                rich_text: [{ text: { content: payload.body.substring(0, 2000) } }],
              },
            },
          }),
          signal: AbortSignal.timeout(5000),
        });

        results.push({
          connectorId: connector.id,
          type: connector.type,
          success: res.ok,
          status: res.status,
          error: res.ok ? undefined : `Notion API Error Status ${res.status}`,
        });
      } else if (connector.type === "airtable") {
        if (!connector.apiKey || !connector.databaseId) {
          results.push({
            connectorId: connector.id,
            type: connector.type,
            success: false,
            error: "Missing Airtable API key or Base/Table string",
          });
          continue;
        }

        // databaseId is expected as 'baseId/tableName'
        const [baseId, table] = connector.databaseId.split("/");
        const tableName = table || "Webhooks";
        const res = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${connector.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: {
              Slug: payload.slug,
              Timestamp: payload.timestamp,
              Payload: payload.body.substring(0, 5000),
            },
          }),
          signal: AbortSignal.timeout(5000),
        });

        results.push({
          connectorId: connector.id,
          type: connector.type,
          success: res.ok,
          status: res.status,
          error: res.ok ? undefined : `Airtable API Error Status ${res.status}`,
        });
      }
    } catch (err: any) {
      results.push({
        connectorId: connector.id,
        type: connector.type,
        success: false,
        error: err.message || "Connector execution failed",
      });
    }
  }

  return results;
}
