/**
 * @fileoverview Stdio transport implementation for Mailgun MCP Server
 * @description Standard input/output transport for local MCP clients like Claude Desktop.
 *              This is the default transport mode, maintaining backward compatibility
 *              with the original implementation.
 * @see https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#stdio
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

/**
 * Initializes and connects the stdio transport
 *
 * This transport communicates via standard input/output streams, suitable for
 * local integrations where the MCP server is spawned as a subprocess.
 *
 * @param {McpServer} server - The configured MCP server instance
 * @returns {Promise<void>}
 *
 * @example
 * import { createMcpServer } from '../server.js';
 * import { initStdioTransport } from './stdio.js';
 *
 * const server = createMcpServer();
 * await initStdioTransport(server);
 */
export async function initStdioTransport(server) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Mailgun MCP Server running on stdio");
}
