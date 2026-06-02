import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CodeSearchClient } from "./client.js";
import { getConfig } from "./config.js";
import { registerCodeSearchTools } from "./tools/code-search.js";

const VERSION = "0.1.0";

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

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  // Strip the draft-07 `$schema` the MCP SDK stamps on tool schemas; Anthropic
  // rejects it ("must match JSON Schema draft 2020-12") when the full tool set
  // is sent, e.g. on subagent spawns. Intercept tools/list output here.
  const __send = transport.send.bind(transport);
  (transport as any).send = (message: any) => {
    const tools = message?.result?.tools;
    if (Array.isArray(tools)) {
      for (const t of tools) {
        if (t?.inputSchema) delete t.inputSchema.$schema;
        if (t?.outputSchema) delete t.outputSchema.$schema;
      }
    }
    return __send(message);
  };
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`code-search-mcp fatal: ${msg}`);
  process.exit(1);
});
