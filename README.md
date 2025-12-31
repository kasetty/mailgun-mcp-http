# Mailgun MCP Server
[![MCP](https://img.shields.io/badge/MCP-Server-blue.svg)](https://github.com/modelcontextprotocol)

## Overview
A Model Context Protocol (MCP) server implementation for [Mailgun](https://mailgun.com), enabling MCP-compatible AI clients like Claude Desktop to interact with the service.

This server supports two transport modes:
- **stdio** (default): For local integrations like Claude Desktop
- **http**: For remote deployments via Obot MCP Gateway and other HTTP-based MCP clients

## Prerequisites

- Node.js (v18 or higher)
- Git
- Claude Desktop (for Claude integration)
- Mailgun account and an API key

## Deployment Options

### Option 1: Local/Claude Desktop (stdio transport - default)

1. Clone the repository:
   ```bash
   git clone https://github.com/mailgun/mailgun-mcp-server.git
   cd mailgun-mcp-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Claude Desktop:

   Create or modify the config file:
   - MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%/Claude/claude_desktop_config.json`

   Add the following configuration:
   ```json
   {
       "mcpServers": {
           "mailgun": {
               "command": "node",
               "args": ["CHANGE/THIS/PATH/TO/mailgun-mcp-server/src/mailgun-mcp.js"],
               "env": {
                   "MAILGUN_API_KEY": "YOUR-mailgun-api-key"
               }
           }
       }
   }
   ```

### Option 2: Obot MCP Gateway (HTTP transport)

This server can be deployed to Obot's MCP Gateway platform using HTTP Streaming transport.

#### Using Docker

1. Build the container:
   ```bash
   docker build -t mailgun-mcp-server .
   ```

2. Run locally for testing:
   ```bash
   docker run -p 3000:3000 \
     -e TRANSPORT=http \
     -e MAILGUN_API_KEY=your-api-key \
     mailgun-mcp-server
   ```

3. Test the health endpoint:
   ```bash
   curl http://localhost:3000/health
   ```

   Expected response:
   ```json
   {
     "status": "healthy",
     "service": "mailgun-mcp-server",
     "transport": "http",
     "timestamp": "2025-01-01T00:00:00.000Z"
   }
   ```

#### Obot MCP Gateway Configuration

1. Push your container to a registry (Docker Hub, GitHub Container Registry, etc.):
   ```bash
   docker tag mailgun-mcp-server your-registry/mailgun-mcp-server:latest
   docker push your-registry/mailgun-mcp-server:latest
   ```

2. In Obot MCP Gateway, add a new **Containerized** MCP server:
   - **Image**: `your-registry/mailgun-mcp-server:latest`
   - **Port**: `3000`
   - **Path**: `/mcp`
   - **Environment Variables**:
     - `TRANSPORT`: `http`
     - `MAILGUN_API_KEY`: (configure as user-supplied or shared)

#### Running without Docker (HTTP mode)

```bash
TRANSPORT=http PORT=3000 MAILGUN_API_KEY=your-key node src/mailgun-mcp.js
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MAILGUN_API_KEY` | Yes | - | Your Mailgun API key |
| `TRANSPORT` | No | `stdio` | Transport mode: `stdio` or `http` |
| `PORT` | No | `3000` | HTTP server port (http transport only) |
| `HOST` | No | `0.0.0.0` | HTTP bind address (http transport only) |

## API Endpoints (HTTP Transport)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | MCP Streamable HTTP endpoint (initialize sessions, tool calls) |
| `/mcp` | GET | MCP SSE stream for server-sent events |
| `/mcp` | DELETE | Terminate an MCP session |
| `/health` | GET | Health check (returns 200 OK with JSON status) |

### MCP Session Flow

1. **Initialize**: Send a POST to `/mcp` with an initialize request
2. **Session ID**: Server returns `mcp-session-id` header in the response
3. **Tool Calls**: Subsequent POST requests must include the `mcp-session-id` header
4. **SSE Stream**: GET `/mcp` with `mcp-session-id` header for server notifications
5. **Terminate**: DELETE `/mcp` with `mcp-session-id` header to end session

## Testing

Run the local test suite with:

```bash
NODE_ENV=test npm test
```

### Sample Prompts with Claude

#### Send an Email

> Note: sending an email currently (2025-03-18) seems to require a paid account with Anthropic. You'll get a silent failure on the free account

```
Can you send an email to EMAIL_HERE with a funny email body that makes it sound like it's from the IT Desk from Office Space?
Please use the sending domain DOMAIN_HERE, and make the email from "postmaster@DOMAIN_HERE"!
```

#### Fetch and Visualize Sending Statistics

```
Would you be able to make a chart with email delivery statistics for the past week?
```

## Architecture

```
src/
├── mailgun-mcp.js          # Main entry point (transport selection)
├── server.js               # Shared MCP server setup (tools, handlers)
└── transports/
    ├── stdio.js            # Stdio transport (Claude Desktop)
    └── http.js             # HTTP streaming transport (Obot MCP Gateway)
```

### Transport Selection

The server automatically selects the transport based on the `TRANSPORT` environment variable:

- `TRANSPORT=stdio` (default): Uses stdin/stdout for local integrations
- `TRANSPORT=http`: Starts an Express server with Streamable HTTP transport

## Debugging

The MCP server communicates over stdio, please refer to [Debugging](https://modelcontextprotocol.io/docs/tools/debugging) section of the Model Context Protocol.

For HTTP transport, you can use standard HTTP debugging tools like `curl` or Postman.

## Security Considerations

- **API Key Protection**: Never commit your `MAILGUN_API_KEY` to version control
- **Container Security**: The Docker image runs as a non-root user
- **CORS**: HTTP transport includes CORS headers for cross-origin requests
- **Session Management**: MCP sessions are tracked server-side with secure UUIDs

## License

[LICENSE](LICENSE) file for details

## Contributing

We welcome contributions! Please feel free to submit a Pull Request.
