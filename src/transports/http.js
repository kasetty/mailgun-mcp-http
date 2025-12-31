/**
 * @fileoverview HTTP Streaming transport implementation for Mailgun MCP Server
 * @description Enables deployment to Obot MCP Gateway and other HTTP-based MCP clients.
 *              This transport implements the MCP Streamable HTTP specification.
 * @see https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http
 */

import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

/**
 * Initializes the HTTP streaming transport server
 *
 * Creates an Express server with:
 * - CORS enabled for cross-origin requests
 * - Health check endpoint at /health
 * - MCP endpoint at /mcp for all MCP communication
 * - Graceful shutdown handling
 *
 * @param {McpServer} server - The configured MCP server instance
 * @param {Object} options - Transport configuration options
 * @param {number} [options.port=3000] - Port to listen on
 * @param {string} [options.host='0.0.0.0'] - Host to bind to
 * @returns {Promise<Object>} Object containing the Express app and HTTP server
 *
 * @example
 * import { createMcpServer } from '../server.js';
 * import { initHttpTransport } from './http.js';
 *
 * const server = createMcpServer();
 * const { app, httpServer } = await initHttpTransport(server, { port: 8080 });
 */
export async function initHttpTransport(server, options = {}) {
  const port = options.port || parseInt(process.env.PORT) || 3000;
  const host = options.host || process.env.HOST || "0.0.0.0";

  const app = express();

  // Enable CORS for cross-origin requests from MCP clients
  app.use(cors({
    origin: true, // Reflect the request origin
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "mcp-session-id"],
    exposedHeaders: ["mcp-session-id"],
    credentials: true
  }));

  // Parse JSON request bodies
  app.use(express.json());

  /**
   * Health check endpoint
   * Used by container orchestration and load balancers to verify service health
   */
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "healthy",
      service: "mailgun-mcp-server",
      transport: "http",
      timestamp: new Date().toISOString()
    });
  });

  /**
   * Store active transports by session ID for session management
   * @type {Map<string, StreamableHTTPServerTransport>}
   */
  const transports = new Map();

  /**
   * MCP Streamable HTTP endpoint
   * Handles all MCP protocol communication including:
   * - Initialize requests (creates new sessions)
   * - Tool calls and responses
   * - Session management
   */
  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];

    // Check if this is an initialize request (starts a new session)
    if (isInitializeRequest(req.body)) {
      // Create a new transport for this session
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (newSessionId) => {
          // Store the transport with its session ID
          transports.set(newSessionId, transport);
          console.error(`[HTTP] New MCP session initialized: ${newSessionId}`);
        }
      });

      // Clean up transport when closed
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports.has(sid)) {
          transports.delete(sid);
          console.error(`[HTTP] MCP session closed: ${sid}`);
        }
      };

      // Connect the MCP server to this transport
      await server.connect(transport);

      // Handle the initialize request
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // For non-initialize requests, require a valid session
    if (!sessionId) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Missing mcp-session-id header. Initialize a session first."
        },
        id: null
      });
      return;
    }

    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Session not found. It may have expired or been closed."
        },
        id: null
      });
      return;
    }

    // Handle the request with the existing session's transport
    await transport.handleRequest(req, res, req.body);
  });

  /**
   * Handle GET requests for SSE streams (server-sent events)
   */
  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];
    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Missing or invalid session ID. Initialize a session first with POST /mcp"
        },
        id: null
      });
      return;
    }

    const transport = transports.get(sessionId);
    await transport.handleRequest(req, res);
  });

  /**
   * Handle DELETE requests for session termination
   */
  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId);
      await transport.close();
      transports.delete(sessionId);
      res.status(200).json({ message: "Session terminated" });
    } else {
      res.status(404).json({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Session not found"
        },
        id: null
      });
    }
  });

  // Start the HTTP server
  const httpServer = app.listen(port, host, () => {
    console.error(`Mailgun MCP Server running on http://${host}:${port}`);
    console.error(`  - Health check: http://${host}:${port}/health`);
    console.error(`  - MCP endpoint: http://${host}:${port}/mcp`);
  });

  // Handle graceful shutdown
  const shutdown = async (signal) => {
    console.error(`\n[HTTP] Received ${signal}, shutting down gracefully...`);

    // Close all active transports
    for (const [sessionId, transport] of transports) {
      console.error(`[HTTP] Closing session: ${sessionId}`);
      await transport.close();
    }
    transports.clear();

    // Close the HTTP server
    httpServer.close(() => {
      console.error("[HTTP] Server closed");
      process.exit(0);
    });

    // Force exit after timeout
    setTimeout(() => {
      console.error("[HTTP] Forcing shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return { app, httpServer };
}
