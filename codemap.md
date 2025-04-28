# Canvas Server Codemap

## Authentication System

- `src/services/auth/index.js` - Central AuthService responsible for user authentication, session management, and API token management
- `src/services/auth/lib/SessionService.js` - Handles session and JWT token management

## Authentication API and Middleware

- `src/transports/http/routes/v2/auth.js` - HTTP auth routes (login, register, token management)
- `src/transports/common/middleware/auth.js` - Common authentication middleware used by all transports
- `src/transports/http/middleware/auth.js` - HTTP-specific auth middleware
- `src/transports/ws/middleware/auth.js` - WebSocket-specific auth middleware

## User Management

- `src/managers/user/index.js` - UserManager for creating and managing users
- `src/managers/user/lib/User.js` - User class representing a user instance

## Tokens

The Canvas authentication system uses API tokens for authentication:

- Tokens are created and managed by the AuthService
- Token operations are centralized in the AuthService
- Tokens are linked to users by userId
- Tokens are validated by hashing the provided token and comparing with stored hashes
- Only token hashes are stored for security, raw values are only returned once when created 
