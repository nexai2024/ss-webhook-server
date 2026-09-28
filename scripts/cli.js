#!/usr/bin/env node

/**
 * Endpoint Builders Localhost Tunnel CLI
 * Usage: node scripts/cli.js --slug my-slug --to http://localhost:3000/api/receive --host http://localhost:3000
 */

const args = process.argv.slice(2);

function getArg(flag, defaultValue) {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return defaultValue;
}

const slug = getArg("--slug", "");
const targetUrl = getArg("--to", "http://localhost:3000/api/local");
const serverHost = getArg("--host", "http://localhost:3000");

if (!slug) {
  console.error("Error: Please specify endpoint slug with --slug <slug>");
  console.log("Usage: node scripts/cli.js --slug <slug> --to <localUrl> [--host <host>]");
  process.exit(1);
}

const sseUrl = `${serverHost.replace(/\/$/, "")}/api/webhooks/${slug}/stream`;

console.log("==================================================");
console.log("🚀 Endpoint Builders Local Tunnel active!");
console.log(`📡 Listening for webhooks at: ${serverHost}/api/webhooks/${slug}`);
console.log(`🔀 Tunneling incoming payloads to: ${targetUrl}`);
console.log("==================================================");

async function forwardLocal(payload) {
  console.log(`\n⚡ [${new Date().toLocaleTimeString()}] Incoming ${payload.method || "POST"} request captured!`);
  try {
    const res = await fetch(targetUrl, {
      method: payload.method || "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tunneled-By": "Endpoint Builders CLI",
        ...(payload.headers || {}),
      },
      body: typeof payload.body === "string" ? payload.body : JSON.stringify(payload.body || {}),
    });
    console.log(`✅ Forwarded to ${targetUrl} — Status: ${res.status}`);
  } catch (err) {
    console.error(`❌ Failed to forward to ${targetUrl}: ${err.message}`);
  }
}

async function startTunnel() {
  try {
    const res = await fetch(sseUrl);
    if (!res.ok) {
      console.error(`Failed to connect to SSE stream: ${res.status} ${res.statusText}`);
      process.exit(1);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const block of lines) {
        for (const line of block.split("\n")) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            try {
              const event = JSON.parse(dataStr);
              if (event.type === "webhook_event" && event.payload) {
                forwardLocal(event.payload);
              } else if (event.type === "connected") {
                console.log("🟢 Connected to live stream.");
              }
            } catch (e) {
              // Ignore parse error
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`Tunnel stream disconnected: ${err.message}. Retrying in 3s...`);
    setTimeout(startTunnel, 3000);
  }
}

startTunnel();
