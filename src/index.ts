import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CodeSearchClient } from "./client.js";
import { getConfig } from "./config.js";
import { registerCodeSearchTools } from "./tools/code-search.js";
import pkg from "../package.json" with { type: "json" };

export const VERSION = pkg.version;

export function createServer(): McpServer {
  const config = getConfig();
  const client = new CodeSearchClient(config);
  const server = new McpServer({
    name: "code-search-mcp",
    version: VERSION,
    description:
      "Read-only MCP server for querying a local code-search-api semantic index by intent.",
  });

  registerCodeSearchTools(server, client);
  return server;
}

// Strip the draft-07 `$schema` the MCP SDK stamps on tool schemas; Anthropic
// rejects it ("must match JSON Schema draft 2020-12") when the full tool set
// is sent, e.g. on subagent spawns. Used to intercept tools/list output.
export function stripDraftSchema(message: any): void {
  const tools = message?.result?.tools;
  if (Array.isArray(tools)) {
    for (const t of tools) {
      if (t?.inputSchema) delete t.inputSchema.$schema;
      if (t?.outputSchema) delete t.outputSchema.$schema;
    }
  }
}

export function applySchemaStripIntercept(transport: { send: (message: any, ...rest: any[]) => unknown }): void {
  const __send = transport.send.bind(transport);
  (transport as any).send = (message: any, ...rest: any[]) => {
    stripDraftSchema(message);
    return __send(message, ...rest);
  };
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  applySchemaStripIntercept(transport);
  await server.connect(transport);
}

// True when this module is the process entrypoint. process.argv[1] is often a
// symlink (npm installs the bin as a link), so resolve it to its real path
// before comparing - otherwise a symlinked launch never starts the server.
const isEntrypoint = (() => {
  const arg = process.argv[1];
  if (typeof arg !== "string") return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(arg)).href;
  } catch {
    return false;
  }
})();

if (isEntrypoint) {
  main().catch((error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`code-search-mcp fatal: ${msg}`);
    process.exit(1);
  });
}
