/**
 * @fileoverview Main entry point for Mailgun MCP Server
 * @description Supports both stdio and HTTP streaming transports.
 *              Transport selection is controlled via the TRANSPORT environment variable.
 *
 * Environment Variables:
 *   - TRANSPORT: Transport mode - 'stdio' (default) or 'http'
 *   - MAILGUN_API_KEY: Required Mailgun API key
 *   - PORT: HTTP server port (default: 3000, http transport only)
 *   - HOST: HTTP bind address (default: 0.0.0.0, http transport only)
 *
 * @example
 * // Start with stdio transport (default, for Claude Desktop)
 * node src/mailgun-mcp.js
 *
 * @example
 * // Start with HTTP transport (for Obot MCP Gateway)
 * TRANSPORT=http PORT=3000 node src/mailgun-mcp.js
 */

import { createMcpServer } from "./server.js";
import { initStdioTransport } from "./transports/stdio.js";
import { initHttpTransport } from "./transports/http.js";

// Re-export server and utilities for backward compatibility with tests
export {
  createMcpServer,
  makeMailgunRequest,
  loadOpenApiSpec,
  openapiToZod,
  generateToolsFromOpenApi,
  getOperationDetails,
  sanitizeToolId,
  buildParamsSchema,
  processParameters,
  processRequestBody,
  resolveReference,
  registerTool,
  processPathParameters,
  separateParameters,
  appendQueryString
} from "./server.js";

// Create a shared server instance for backward compatibility
export const server = createMcpServer();

/**
 * Main function to initialize and start the MCP server
 *
 * Selects transport based on TRANSPORT environment variable:
 * - 'stdio' (default): Uses stdin/stdout for communication
 * - 'http': Starts an HTTP server with Streamable HTTP transport
 *
 * @returns {Promise<void>}
 */
export async function main() {
  const transport = process.env.TRANSPORT || "stdio";

  try {
    // Create a new server instance for main execution
    const mcpServer = createMcpServer();

    if (transport === "http") {
      // HTTP Streaming transport for Obot MCP Gateway
      const port = parseInt(process.env.PORT) || 3000;
      const host = process.env.HOST || "0.0.0.0";

      await initHttpTransport(mcpServer, { port, host });
    } else {
      // Default: stdio transport for Claude Desktop and local usage
      await initStdioTransport(mcpServer);
    }
  } catch (error) {
    console.error("Fatal error in main():", error);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
}

// Only auto-execute when not in test environment
if (process.env.NODE_ENV !== 'test') {
  main();
}
