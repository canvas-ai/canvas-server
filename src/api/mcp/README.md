# Canvas MCP (Model Context Protocol) Server

This directory contains the implementation of the Model Context Protocol (MCP) server for Canvas, providing standardized access to Canvas contexts and documents through the MCP protocol.

## Overview

The Canvas MCP server exposes Canvas functionality through the [Model Context Protocol](https://github.com/modelcontextprotocol/typescript-sdk), allowing AI assistants and other clients to interact with Canvas contexts and documents in a standardized way.

## Features

### Supported Operations

#### Context Lifecycle
- **list_contexts**: List all contexts for the authenticated user
- **get_context**: Get detailed information about a specific context
- **create_context**: Create a new context
- **remove_context**: Remove/delete a context

#### Document Operations (Read-only)
- **find_documents**: Find documents in a context with optional filters
- **get_document**: Get a specific document by ID from a context
- **query_documents**: Query documents with a flexible query interface

### MCP Resources

The server exposes Canvas data as MCP resources with the following URI scheme:

- `canvas://contexts/{contextId}` - Context data
- `canvas://contexts/{contextId}/documents/{documentId}` - Document data

### MCP Tools

All operations are available as MCP tools with structured input/output schemas.

## API Endpoints

### SSE (Server-Sent Events) Transport

The implementation uses SSE transport as specified in the MCP protocol:

- **GET /mcp/v1/sse** - Establish MCP SSE connection
- **POST /mcp/v1/messages** - Send messages to MCP server
- **GET /mcp/v1/status** - Get server status and capabilities
- **GET /mcp/v1/sessions** - List active sessions (admin only)

## Authentication

The MCP server uses the same authentication system as the rest of Canvas:

- **Bearer Token Authentication**: Pass your Canvas API token or JWT token in the `Authorization` header
- **API Tokens**: Tokens starting with `canvas-` (recommended for programmatic access)
- **JWT Tokens**: Standard Canvas user JWT tokens

### Example Authentication

```bash
# Using API token
curl -H "Authorization: Bearer canvas-your-api-token-here" \
     http://localhost:8080/mcp/v1/status

# Using JWT token
curl -H "Authorization: Bearer your-jwt-token-here" \
     http://localhost:8080/mcp/v1/status
```

## Usage Examples

### 1. Check Server Status

```bash
curl -H "Authorization: Bearer your-token" \
     http://localhost:8080/mcp/v1/status
```

### 2. Establish SSE Connection

```javascript
const eventSource = new EventSource('http://localhost:8080/mcp/v1/sse', {
  headers: {
    'Authorization': 'Bearer your-token'
  }
});

eventSource.onmessage = (event) => {
  console.log('MCP message:', event.data);
};
```

### 3. Send MCP Tool Call

```javascript
// After establishing SSE connection and getting session ID
const message = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'list_contexts',
    arguments: {}
  }
};

fetch('http://localhost:8080/mcp/v1/messages?sessionId=your-session-id', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(message)
});
```

### 4. Create a Context

```javascript
const createContextMessage = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
    name: 'create_context',
    arguments: {
      id: 'my-new-context',
      url: 'universe://my-new-context',
      description: 'A test context created via MCP',
      type: 'context'
    }
  }
};
```

### 5. Find Documents

```javascript
const findDocsMessage = {
  jsonrpc: '2.0',
  id: 3,
  method: 'tools/call',
  params: {
    name: 'find_documents',
    arguments: {
      contextId: 'my-context',
      contextPath: '/',
      features: ['BaseDocument'],
      filters: [],
      limit: 10
    }
  }
};
```

## Testing

Run the included test script to verify the MCP implementation:

```bash
# Set your API token
export CANVAS_API_TOKEN=your-api-token

# Run the test
node tests/mcp_test.js
```

The test script will:
1. Check the MCP status endpoint
2. Establish an SSE connection
3. Send test messages
4. Report results

## Implementation Details

### File Structure

```
src/api/mcp/
├── index.js       # Main CanvasMcpServer class
├── routes.js      # Fastify route handlers
└── README.md      # This documentation
```

### Key Components

- **CanvasMcpServer**: Main MCP server implementation using the MCP TypeScript SDK
- **mcpRoutes**: Fastify route handlers that integrate with Canvas authentication
- **Authentication**: Reuses existing Canvas auth strategies (API tokens, JWT)
- **Session Management**: Tracks active SSE sessions with user context

### Architecture

```
MCP Client (AI Assistant)
    ↓ SSE/HTTP
Fastify Routes (/mcp/v1/*)
    ↓ Authentication
CanvasMcpServer
    ↓ Canvas APIs
ContextManager, UserManager, etc.
```

## Error Handling

The MCP server provides structured error responses:

- **401 Unauthorized**: Invalid or missing authentication
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource or session not found
- **500 Internal Server Error**: Server-side errors

All errors include descriptive messages to help with debugging.

## Limitations

### Current Limitations

1. **Document Operations**: Only read-only operations are supported (no create/update/delete)
2. **JWT Authentication**: Currently only API tokens are fully supported for MCP
3. **Resource Listing**: Limited to 50 documents per context for performance
4. **Session Management**: Basic session tracking without persistence

### Future Enhancements

- **Document Mutations**: Add support for creating/updating documents
- **Advanced Filtering**: More sophisticated document query capabilities
- **Streaming Results**: Stream large result sets
- **WebSocket Transport**: Support for WebSocket transport in addition to SSE
- **Batch Operations**: Support for batch document operations
- **Real-time Updates**: Push notifications for context/document changes

## Security Considerations

- All operations require authentication
- Users can only access their own contexts and documents
- Session isolation prevents cross-user access
- Rate limiting should be considered for production deployments
- Audit logging for MCP operations (TODO)

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify your API token is valid and has the correct permissions
   - Check that the token hasn't expired
   - Ensure the Authorization header is properly formatted

2. **Connection Issues**
   - Verify the Canvas server is running and accessible
   - Check for CORS issues if connecting from a browser
   - Ensure the SSE endpoint is properly configured

3. **Session Errors**
   - Session IDs are generated automatically or can be provided
   - Sessions are cleaned up when the SSE connection closes
   - Check that the session belongs to the authenticated user

### Debug Mode

Enable debug logging for MCP-specific operations:

```bash
DEBUG=canvas-server:mcp* npm start
```

This will show detailed logs for MCP server initialization, authentication, and request processing.

## Contributing

When adding new MCP functionality:

1. Add new tools to the `#setupTools()` method in `CanvasMcpServer`
2. Add corresponding routes if needed in `routes.js`
3. Update this documentation
4. Add tests to verify the new functionality
5. Consider security implications and access control

## References

- [Model Context Protocol Specification](https://github.com/modelcontextprotocol/typescript-sdk)
- [Canvas Server Documentation](../../README.md)
- [Fastify Documentation](https://www.fastify.io/)
- [Server-Sent Events (SSE) Specification](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) 
