# Dockerfile for Mailgun MCP Server with HTTP Streaming
#
# This Dockerfile creates a production-ready container for the Mailgun MCP Server
# with HTTP Streaming transport support, suitable for deployment to Obot MCP Gateway
# and other containerized environments.
#
# Build:
#   docker build -t mailgun-mcp-server .
#
# Run:
#   docker run -p 3000:3000 \
#     -e TRANSPORT=http \
#     -e MAILGUN_API_KEY=your-api-key \
#     mailgun-mcp-server
#
# Environment Variables:
#   - TRANSPORT: Transport mode ('stdio' or 'http', default: 'http')
#   - PORT: HTTP server port (default: 3000)
#   - HOST: HTTP bind address (default: 0.0.0.0)
#   - MAILGUN_API_KEY: Your Mailgun API key (required)

FROM node:20-alpine

# Security: Run as non-root user
RUN addgroup -g 1001 -S mcpuser && \
    adduser -S mcpuser -u 1001

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY src/ ./src/

# Set ownership
RUN chown -R mcpuser:mcpuser /app

USER mcpuser

# Default environment for HTTP transport
ENV TRANSPORT=http
ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production

EXPOSE 3000

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

CMD ["node", "src/mailgun-mcp.js"]
