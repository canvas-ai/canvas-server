# Canvas API Token Authentication

Canvas provides a simple API token-based authentication system for secure remote access to the Canvas server. This document explains how to create, manage, and use API tokens with various clients.

## API Token Overview

API tokens are the primary authentication method for:
- canvas-electron
- canvas-cli
- canvas-shell (curl-based tools)
- browser extensions
- automated scripts and integrations
- all remote access

Each token is associated with a specific user account and has a unique identifier. Tokens start with the prefix `cvs_` for easy identification and use secure cryptographic methods for generation and validation.

## Creating an API Token

### Via Web UI

1. Log in to the Canvas Web UI
2. Navigate to Settings > API Tokens
3. Click "Create New Token"
4. Provide a name and optional expiration date
5. Copy the generated token immediately (it will only be shown once)

### Via API

```bash
# First authenticate with existing token or credentials
curl -X POST https://your-canvas-server/api/v2/auth/tokens \
  -H "Authorization: Bearer cvs_your_existing_token" \
  -H "Content-Type: application/json" \
  -d '{"name": "My CLI Token", "description": "Token for CLI access"}'
```

## Using API Tokens

API tokens can be used in several ways:

### 1. Authorization Header (Recommended)

Add the token in the Authorization header:

```bash
curl https://your-canvas-server/api/v2/auth/me \
  -H "Authorization: Bearer cvs_your_token_here"
```

### 2. Query Parameter (For GET requests only)

```bash
curl https://your-canvas-server/api/v2/auth/me?token=cvs_your_token_here
```

### 3. For Canvas Tools

#### canvas-cli

```bash
# Set token permanently
canvas config set token cvs_your_token_here

# Or use environment variable
CANVAS_TOKEN=cvs_your_token_here canvas status
```

#### canvas-shell

```bash
# Set token permanently
cs config token cvs_your_token_here

# Or provide with each command
cs --token=cvs_your_token_here status
```

## Managing Tokens

### Listing Tokens

```bash
curl https://your-canvas-server/api/v2/auth/tokens \
  -H "Authorization: Bearer cvs_your_token_here"
```

### Revoking a Token

```bash
curl -X DELETE https://your-canvas-server/api/v2/auth/tokens/TOKEN_ID \
  -H "Authorization: Bearer cvs_your_token_here"
```

## Security Features

Canvas API tokens include several security features:

1. **Secure Generation**: Tokens are created using cryptographically secure methods
2. **Secure Storage**: Tokens are stored as SHA-256 hashes, not raw values
3. **Standard Format**: All tokens use the `cvs_` prefix for easy identification
4. **Expiration Support**: Optional expiration dates can be set for sensitive tokens
5. **Usage Tracking**: Each use of a token is logged with timestamps

## Security Best Practices

1. Create different tokens for different applications
2. Use meaningful names to identify tokens in logs and UI
3. Set expiration dates for sensitive tokens
4. Revoke tokens when no longer needed
5. Never share your tokens in public repositories or communications
6. Use HTTPS when connecting to remote Canvas servers
7. Regularly audit active tokens and their usage

## Troubleshooting

If you're having issues with API token authentication:

1. Verify the token is active in the Canvas Web UI
2. Check that the token is being sent correctly (correct format, not expired)
3. Make sure you're including the full token including the `cvs_` prefix
4. Check server logs for authentication errors
5. Verify you're making HTTPS requests when connecting to remote servers

For more information, see the complete [Canvas API documentation](./api.md). 
