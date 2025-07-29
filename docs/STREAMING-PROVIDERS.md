# LLM Provider Streaming Support

This document explains how different LLM providers support streaming and how Canvas automatically selects the optimal streaming method for each provider.

## Provider Streaming Capabilities

### 🤖 **Anthropic (Claude)**
- ✅ **WebSocket Streaming**: Full bidirectional streaming support
- ✅ **SSE Streaming**: Server-Sent Events fallback
- ✅ **REST API**: Traditional request-response fallback
- **Optimal Method**: WebSocket for real-time streaming

### 🧠 **OpenAI (GPT)**
- ✅ **WebSocket Streaming**: Full bidirectional streaming support  
- ✅ **SSE Streaming**: Server-Sent Events fallback
- ✅ **REST API**: Traditional request-response fallback
- **Optimal Method**: WebSocket for real-time streaming

### 🦙 **Ollama (Local Models)**
- ❌ **WebSocket Streaming**: Not currently supported by Ollama
- ✅ **SSE Streaming**: Primary streaming method (optimized)
- ✅ **REST API**: Traditional request-response fallback
- **Optimal Method**: SSE streaming (direct, no WebSocket overhead)

## Automatic Streaming Selection

Canvas automatically detects the agent's LLM provider and chooses the optimal streaming method:

```javascript
// Smart provider-based streaming selection
if (llmProvider === 'ollama') {
  // Skip WebSocket, go directly to SSE (optimal for Ollama)
  console.log('🦙 Ollama detected: Using SSE streaming')
} else if (llmProvider === 'anthropic' || llmProvider === 'openai') {
  // Try WebSocket first, fallback to SSE if needed
  console.log('🔌 Attempting WebSocket streaming...')
}
```

## Streaming Method Hierarchy

### **For Anthropic & OpenAI**:
1. **WebSocket** (Primary) - Real-time bidirectional streaming
2. **SSE** (Fallback) - One-way streaming if WebSocket fails
3. **REST** (Final fallback) - Traditional request-response

### **For Ollama**:
1. **SSE** (Primary) - Optimized streaming method for Ollama
2. **REST** (Fallback) - Traditional request-response if SSE fails

## User Experience

- **Visual Indicators**: Connection status shows the active streaming method
  - 🟢 **WebSocket** (Anthropic/OpenAI)
  - 🔵 **SSE (Ollama)** or **SSE Fallback** 
  - 🟡 **REST API**
  - 🔴 **Disconnected**

- **Seamless Fallbacks**: Users experience consistent streaming regardless of method
- **Provider-Aware Messaging**: UI explains why Ollama uses SSE instead of WebSocket

## Performance Notes

- **Ollama + SSE**: Optimized path with no WebSocket connection overhead
- **Anthropic/OpenAI + WebSocket**: Lowest latency for supported providers
- **Automatic Retry**: System handles connection issues gracefully across all methods

## Troubleshooting

### Ollama Shows "WebSocket Error"
✅ **This is expected and normal** - Ollama doesn't support WebSocket streaming. The system automatically uses SSE streaming instead.

### Authentication Errors with WebSocket
- Check JWT token validity and expiration
- Verify token format (JWT vs API token)
- Run `node tests/test-websocket-auth.js` for debugging

### SSE Streaming Issues
- Verify agent is active and accessible
- Check network connectivity
- Review server logs for SSE endpoint errors

## Implementation Details

The streaming selection logic is implemented in:
- `src/ui/web/src/hooks/useAgentChat.ts` - Main streaming logic
- `src/ui/web/src/hooks/useAgentSocket.ts` - WebSocket implementation  
- `src/ui/web/src/services/agent.ts` - SSE implementation 
