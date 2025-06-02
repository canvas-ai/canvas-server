# Canvas Server Authentication

Canvas Server supports multiple authentication strategies to provide flexible user access control. This document covers all available authentication methods, configuration options, and best practices.

## Table of Contents

- [Overview](#overview)
- [Authentication Strategies](#authentication-strategies)
- [Configuration](#configuration)
- [Local Authentication](#local-authentication)
- [IMAP Authentication](#imap-authentication)
- [TLS/SSL Configuration](#tlsssl-configuration)
- [API Reference](#api-reference)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

## Overview

Canvas Server provides a unified authentication system that supports:

- **Local Authentication**: Traditional email/password with local user accounts
- **IMAP Authentication**: Authentication against external email servers with auto-user creation
- **JWT Tokens**: Secure session management
- **API Tokens**: Long-lived tokens for programmatic access

## Authentication Strategies

### Strategy Selection

Authentication strategies are automatically selected based on:

1. **Auto-detection** (default): Determines the best strategy based on user existence and domain configuration
2. **Explicit strategy**: Users can specify `local`, `imap`, or `auto` during login
3. **Domain-based routing**: IMAP domains are automatically detected from email addresses

### Flow Diagram

```
User Login Request
        ↓
   Strategy = "auto"?
        ↓
   Check existing user
        ↓
User exists? → Yes → Use existing auth method (local/imap)
        ↓ No
   Check IMAP domain config
        ↓
Domain configured? → Yes → Use IMAP authentication
        ↓ No
   Use local authentication
```

## Configuration

Authentication is configured in `server/config/auth.json`:

```json
{
  "strategies": {
    "local": {
      "enabled": true,
      "allowRegistration": true
    },
    "imap": {
      "enabled": true,
      "autoCreateUsers": true,
      "defaultUserType": "user",
      "defaultStatus": "active",
      "domains": {
        // Domain configurations here
      }
    }
  },
  "defaultStrategy": "local",
  "session": {
    "jwtExpiry": "7d",
    "refreshTokenExpiry": "30d"
  }
}
```

### Global Settings

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| `defaultStrategy` | string | Default authentication strategy | `"local"` |
| `session.jwtExpiry` | string | JWT token expiration time | `"7d"` |
| `session.refreshTokenExpiry` | string | Refresh token expiration time | `"30d"` |

## Local Authentication

Local authentication uses traditional email/password combinations with user accounts stored in the Canvas Server database.

### Configuration

```json
{
  "strategies": {
    "local": {
      "enabled": true,
      "allowRegistration": true
    }
  }
}
```

### Features

- **User Registration**: Create new accounts via `/auth/register`
- **Password Management**: Change passwords, reset functionality
- **Email Verification**: Optional email verification workflow
- **User Management**: Full CRUD operations on user accounts

### API Endpoints

- `POST /auth/login` - Login with email/password
- `POST /auth/register` - Register new user account
- `PUT /auth/password` - Change password (authenticated)
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password with token

## IMAP Authentication

IMAP authentication allows users to login using their existing email credentials. When a user successfully authenticates via IMAP, Canvas Server automatically creates a local user account.

### Configuration

```json
{
  "strategies": {
    "imap": {
      "enabled": true,
      "autoCreateUsers": true,
      "defaultUserType": "user",
      "defaultStatus": "active",
      "domains": {
        "company.com": {
          "host": "mail.company.com",
          "port": 993,
          "secure": true,
          "domain": "company.com",
          "name": "Company Mail Server"
        }
      }
    }
  }
}
```

### Domain Configuration

Each domain in the `domains` object supports these properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `host` | string | ✅ | IMAP server hostname |
| `port` | number | ✅ | IMAP server port |
| `secure` | boolean | ✅ | Use SSL/TLS from connection start |
| `domain` | string | ✅ | Email domain (must match key) |
| `name` | string | ✅ | Human-readable server name |
| `startTLS` | boolean | ❌ | Upgrade to TLS after plain connection |
| `requireAppPassword` | boolean | ❌ | Indicates app-specific passwords required |
| `tlsOptions` | object | ❌ | Advanced TLS configuration |

### Auto-User Creation

When IMAP authentication succeeds, Canvas Server automatically:

1. Creates a new user account with the authenticated email
2. Sets up the user's workspace and default context
3. Assigns the configured user type and status
4. Stores IMAP server information for future reference

### User Properties

Auto-created IMAP users have these properties:

```json
{
  "email": "user@company.com",
  "userType": "user",
  "status": "active",
  "authMethod": "imap",
  "imapDomain": "company.com",
  "imapServer": "mail.company.com",
  "name": "user",
  "created": "2024-01-01T00:00:00.000Z",
  "updated": "2024-01-01T00:00:00.000Z"
}
```

## TLS/SSL Configuration

Canvas Server supports multiple TLS/SSL configurations for secure IMAP connections.

### SSL/TLS (Direct Encryption) ⭐ Recommended

```json
{
  "host": "imap.gmail.com",
  "port": 993,
  "secure": true,
  "domain": "gmail.com",
  "name": "Gmail (SSL/TLS)"
}
```

- **Most secure**: Connection encrypted from start
- **Standard port**: 993 (IMAPS)
- **Best for**: Production environments

### STARTTLS (Upgrade to TLS)

```json
{
  "host": "mail.company.com",
  "port": 143,
  "secure": false,
  "startTLS": true,
  "domain": "company.com",
  "name": "Company Mail Server (STARTTLS)"
}
```

- **Good security**: Plain connection upgraded to TLS
- **Standard port**: 143 (IMAP)
- **Best for**: Legacy servers that don't support direct SSL

### Custom TLS Options

```json
{
  "host": "outlook.office365.com",
  "port": 993,
  "secure": true,
  "domain": "outlook.com",
  "name": "Microsoft Outlook",
  "tlsOptions": {
    "servername": "outlook.office365.com",
    "rejectUnauthorized": true,
    "minVersion": "TLSv1.2",
    "maxVersion": "TLSv1.3",
    "ciphers": "HIGH:!aNULL:!MD5"
  }
}
```

### TLS Options Reference

| Option | Type | Description |
|--------|------|-------------|
| `rejectUnauthorized` | boolean | Reject self-signed certificates |
| `servername` | string | SNI hostname for multi-domain certificates |
| `minVersion` | string | Minimum TLS version (`TLSv1.2`, `TLSv1.3`) |
| `maxVersion` | string | Maximum TLS version |
| `ciphers` | string | Allowed cipher suites |
| `checkServerIdentity` | function | Custom certificate validation |

### Development/Testing (Insecure)

```json
{
  "host": "mail.local",
  "port": 143,
  "secure": false,
  "startTLS": false,
  "domain": "local.test",
  "name": "Local Test Server",
  "tlsOptions": {
    "rejectUnauthorized": false
  }
}
```

⚠️ **Warning**: Only use insecure configurations for development/testing environments.

## Popular Email Providers

### Gmail

```json
{
  "host": "imap.gmail.com",
  "port": 993,
  "secure": true,
  "domain": "gmail.com",
  "name": "Gmail",
  "requireAppPassword": true
}
```

**Note**: Gmail requires app-specific passwords when 2FA is enabled.

### Microsoft Outlook/Office 365

```json
{
  "host": "outlook.office365.com",
  "port": 993,
  "secure": true,
  "domain": "outlook.com",
  "name": "Microsoft Outlook",
  "tlsOptions": {
    "servername": "outlook.office365.com"
  }
}
```

### Yahoo Mail

```json
{
  "host": "imap.mail.yahoo.com",
  "port": 993,
  "secure": true,
  "domain": "yahoo.com",
  "name": "Yahoo Mail"
}
```

### Custom Corporate Server

```json
{
  "host": "mail.yourcompany.com",
  "port": 143,
  "secure": false,
  "startTLS": true,
  "domain": "yourcompany.com",
  "name": "Your Company Mail"
}
```

## API Reference

### Authentication Endpoints

#### Get Authentication Configuration

```http
GET /auth/config
```

Returns available authentication strategies and IMAP domains.

**Response:**
```json
{
  "status": "success",
  "payload": {
    "strategies": {
      "local": { "enabled": true },
      "imap": {
        "enabled": true,
        "domains": [
          {
            "domain": "company.com",
            "name": "Company Mail Server",
            "requireAppPassword": false
          }
        ]
      }
    }
  }
}
```

#### Login

```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@company.com",
  "password": "password123",
  "strategy": "auto"  // Optional: "local", "imap", "auto"
}
```

**Response:**
```json
{
  "status": "success",
  "payload": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user-uuid",
      "email": "user@company.com",
      "name": "user",
      "authMethod": "imap"
    }
  }
}
```

#### Current User

```http
GET /auth/me
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "payload": {
    "id": "user-uuid",
    "email": "user@company.com",
    "userType": "user",
    "status": "active"
  }
}
```

### Error Responses

Common error responses include:

| Error | HTTP Status | Description |
|-------|-------------|-------------|
| `Invalid email or password` | 401 | Invalid credentials for local auth |
| `Unsupported login domain` | 400 | Domain not configured for IMAP |
| `Email server authentication failed` | 401 | IMAP server rejected credentials |
| `User account is not active` | 401 | User account disabled |

## Security Considerations

### Best Practices

1. **Use TLS/SSL**: Always use `secure: true` for production
2. **Certificate Validation**: Keep `rejectUnauthorized: true` in production
3. **Strong Passwords**: Enforce password complexity for local accounts
4. **Token Management**: Implement proper token rotation and expiration
5. **Rate Limiting**: Implement login attempt rate limiting
6. **Audit Logging**: Log authentication events for security monitoring

### Security Headers

Ensure your reverse proxy sets appropriate security headers:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

### Password Requirements

For local authentication, enforce:

- Minimum 8 characters
- Mix of uppercase, lowercase, numbers
- Special characters recommended
- Regular password rotation

## Troubleshooting

### Common Issues

#### IMAP Connection Fails

**Symptoms**: `IMAP authentication failed` errors

**Solutions**:
1. Verify server hostname and port
2. Check TLS/SSL configuration
3. Test credentials manually with email client
4. Review server firewall settings
5. Check for app-specific password requirements

#### Certificate Validation Errors

**Symptoms**: `certificate verification failed` errors

**Solutions**:
1. Verify certificate chain is complete
2. Check SNI configuration with `servername` option
3. For testing only: set `rejectUnauthorized: false`
4. Update certificate if expired

#### Auto-User Creation Fails

**Symptoms**: IMAP auth succeeds but user creation fails

**Solutions**:
1. Check user manager initialization
2. Verify database connectivity
3. Review user creation permissions
4. Check for email uniqueness constraints

### Debugging

Enable debug logging:

```bash
DEBUG=canvas-server:auth npm run dev
```

Log levels:
- `ERROR`: Authentication failures and errors
- `INFO`: Successful authentications and user creation
- `DEBUG`: Detailed IMAP connection information

### Log Examples

**Successful IMAP Authentication**:
```
[IMAP] Attempting authentication for user@company.com against mail.company.com
[IMAP] Connection config: mail.company.com:993 (secure: true, startTLS: false)
[IMAP] Successfully authenticated user@company.com
[IMAP] Creating user for user@company.com
[IMAP] Successfully created user: user-uuid-1234
```

**Failed Authentication**:
```
[IMAP] Authentication failed for user@company.com: Invalid credentials
[Auth/Login] IMAP authentication failed: IMAP authentication failed: Invalid credentials
```

## Configuration Examples

### Small Business Setup

```json
{
  "strategies": {
    "local": {
      "enabled": true,
      "allowRegistration": false
    },
    "imap": {
      "enabled": true,
      "autoCreateUsers": true,
      "defaultUserType": "user",
      "defaultStatus": "active",
      "domains": {
        "mybusiness.com": {
          "host": "mail.mybusiness.com",
          "port": 993,
          "secure": true,
          "domain": "mybusiness.com",
          "name": "My Business Mail"
        }
      }
    }
  },
  "defaultStrategy": "auto"
}
```

### Enterprise Setup

```json
{
  "strategies": {
    "local": {
      "enabled": false,
      "allowRegistration": false
    },
    "imap": {
      "enabled": true,
      "autoCreateUsers": true,
      "defaultUserType": "user",
      "defaultStatus": "active",
      "domains": {
        "company.com": {
          "host": "outlook.office365.com",
          "port": 993,
          "secure": true,
          "domain": "company.com",
          "name": "Company Email",
          "tlsOptions": {
            "servername": "outlook.office365.com"
          }
        },
        "contractors.company.com": {
          "host": "mail.company.com",
          "port": 143,
          "secure": false,
          "startTLS": true,
          "domain": "contractors.company.com",
          "name": "Contractor Email"
        }
      }
    }
  },
  "defaultStrategy": "imap"
}
```

### Development Setup

```json
{
  "strategies": {
    "local": {
      "enabled": true,
      "allowRegistration": true
    },
    "imap": {
      "enabled": true,
      "autoCreateUsers": true,
      "defaultUserType": "admin",
      "defaultStatus": "active",
      "domains": {
        "test.local": {
          "host": "mailhog",
          "port": 1143,
          "secure": false,
          "startTLS": false,
          "domain": "test.local",
          "name": "Local Test Server",
          "tlsOptions": {
            "rejectUnauthorized": false
          }
        }
      }
    }
  },
  "defaultStrategy": "local"
}
```

---

For more information about API tokens and programmatic access, see [API Token Authentication](./api-token-auth.md). 
