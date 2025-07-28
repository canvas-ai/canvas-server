# Canvas Server Security Implementation Guide

## Overview

This document provides a comprehensive guide to the security enhancements implemented in Canvas Server, including email verification, enhanced password policies, rate limiting, and other security features.

## New Security Features

### 1. Email Verification System

#### Configuration
Email verification can be enabled/disabled via the `server/config/auth.json` file:

```json
{
  "strategies": {
    "local": {
      "enabled": true,
      "requireEmailVerification": true  // Enable email verification
    }
  }
}
```

#### How It Works
1. **Registration**: When email verification is enabled, new users are created with `status: 'pending'`
2. **Verification Email**: A verification email is automatically sent with a secure token
3. **Email Templates**: Configurable HTML and text templates in `server/config/smtp.json`
4. **Token Expiration**: Verification tokens expire after 48 hours
5. **Account Activation**: Users must verify their email before logging in

#### API Endpoints
- `POST /api/auth/register` - Register new user (sends verification email if enabled)
- `POST /api/auth/request-email-verification` - Request new verification email
- `GET /verify-email/:token` - HTML page for email verification
- `POST /api/verify-email/:token` - API endpoint for email verification

### 2. Enhanced Password Policy

#### Requirements
- **Minimum Length**: 12 characters (configurable)
- **Complexity**: Must include uppercase, lowercase, numbers, and special characters
- **Weak Password Detection**: Blocks common weak passwords
- **Maximum Length**: 128 characters

#### Configuration
```json
{
  "strategies": {
    "local": {
      "passwordPolicy": {
        "minLength": 12,
        "requireUppercase": true,
        "requireLowercase": true,
        "requireNumbers": true,
        "requireSpecialChars": true,
        "maxLength": 128
      }
    }
  }
}
```

### 3. Rate Limiting

#### Login Protection
- **Max Attempts**: 5 attempts per 15 minutes
- **Lockout Duration**: 30 minutes after max attempts
- **IP-based Tracking**: Rate limiting by IP address

#### Registration Protection
- **Max Attempts**: 3 attempts per hour
- **Prevents Abuse**: Protects against automated registration

#### Configuration
```json
{
  "strategies": {
    "local": {
      "rateLimiting": {
        "loginAttempts": {
          "maxAttempts": 5,
          "windowMs": 900000,
          "lockoutDuration": 1800000
        },
        "registration": {
          "maxAttempts": 3,
          "windowMs": 3600000
        }
      }
    }
  }
}
```

### 4. SMTP Configuration

#### Setup
Configure email settings in `server/config/smtp.json`:

```json
{
  "enabled": true,
  "host": "smtp.gmail.com",
  "port": 587,
  "secure": true,
  "auth": {
    "user": "your-email@gmail.com",
    "pass": "your-app-password"
  },
  "from": {
    "name": "Canvas Server",
    "email": "noreply@yourdomain.com"
  }
}
```

#### Email Templates
Customizable email templates for verification and password reset:

```json
{
  "templates": {
    "verification": {
      "subject": "Verify your Canvas account",
      "html": "<h1>Welcome to Canvas!</h1><p>Please click the link below to verify your email address:</p><p><a href=\"{verificationUrl}\">Verify Email</a></p>",
      "text": "Welcome to Canvas! Please visit {verificationUrl} to verify your email address."
    },
    "passwordReset": {
      "subject": "Reset your Canvas password",
      "html": "<h1>Password Reset Request</h1><p>Click the link below to set a new password:</p><p><a href=\"{resetUrl}\">Reset Password</a></p>",
      "text": "You requested a password reset. Visit {resetUrl} to set a new password."
    }
  }
}
```

### 5. Security Headers

#### HTTP Security Headers
The following security headers are automatically added to all responses:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- `Content-Security-Policy`: Comprehensive CSP rules
- `Strict-Transport-Security`: HSTS (production only)

### 6. Input Validation & Sanitization

#### Email Validation
- RFC-compliant email format validation
- Automatic lowercase conversion and trimming
- Domain-specific validation for IMAP authentication

#### Username Validation
- 3-39 characters length
- Only lowercase letters, numbers, underscores, hyphens, and dots
- Blocks system-reserved usernames
- Strict regex pattern matching

## Usage Examples

### 1. Enable Email Verification

1. **Update Configuration**:
   ```bash
   # Edit server/config/auth.json
   {
     "strategies": {
       "local": {
         "requireEmailVerification": true
       }
     }
   }
   ```

2. **Configure SMTP**:
   ```bash
   # Edit server/config/smtp.json
   {
     "enabled": true,
     "host": "smtp.gmail.com",
     "port": 587,
     "secure": true,
     "auth": {
       "user": "your-email@gmail.com",
       "pass": "your-app-password"
     }
   }
   ```

3. **Set Web URL**:
   ```bash
   export CANVAS_WEB_URL="https://your-domain.com"
   ```

### 2. Test Email Verification

Run the test script to verify the email system:

```bash
node scripts/test-email-verification.js
```

### 3. User Registration Flow

```javascript
// Register a new user
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'testuser',
    email: 'test@example.com',
    password: 'SecurePass123!'
  })
});

const result = await response.json();
console.log('Email verification required:', result.data.requireEmailVerification);
```

### 4. Email Verification Flow

```javascript
// Request email verification
await fetch('/api/auth/request-email-verification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test@example.com' })
});

// User clicks link in email: /verify-email/:token
// Or use API: POST /api/verify-email/:token
```

### 5. Password Reset Flow

```javascript
// Request password reset
await fetch('/api/auth/forgot-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test@example.com' })
});

// User clicks link in email: /reset-password/:token
// Or use API: POST /api/reset-password
```

## Security Best Practices

### 1. Production Deployment

1. **Generate Secure JWT Secret**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
   ```

2. **Update Configuration**:
   ```json
   {
     "jwt": {
       "secret": "your-generated-secret-here"
     }
   }
   ```

3. **Use HTTPS**:
   ```bash
   export NODE_ENV=production
   export CANVAS_WEB_URL="https://your-domain.com"
   ```

4. **Configure Reverse Proxy**:
   ```nginx
   # nginx configuration with security headers
   server {
       listen 443 ssl http2;
       server_name your-domain.com;
       
       # Security headers
       add_header X-Frame-Options DENY;
       add_header X-Content-Type-Options nosniff;
       add_header X-XSS-Protection "1; mode=block";
       
       location / {
           proxy_pass http://localhost:8001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

### 2. Email Service Providers

#### Gmail (Recommended for Testing)
```json
{
  "enabled": true,
  "host": "smtp.gmail.com",
  "port": 587,
  "secure": true,
  "auth": {
    "user": "your-email@gmail.com",
    "pass": "your-app-password"
  }
}
```

#### SendGrid
```json
{
  "enabled": true,
  "host": "smtp.sendgrid.net",
  "port": 587,
  "secure": true,
  "auth": {
    "user": "apikey",
    "pass": "your-sendgrid-api-key"
  }
}
```

#### Mailgun
```json
{
  "enabled": true,
  "host": "smtp.mailgun.org",
  "port": 587,
  "secure": true,
  "auth": {
    "user": "your-mailgun-username",
    "pass": "your-mailgun-password"
  }
}
```

### 3. Monitoring & Logging

1. **Enable Security Logging**:
   ```javascript
   // Monitor failed login attempts
   console.log(`[Security] Failed login attempt for ${email} from ${ip}`);
   ```

2. **Set up Alerts**:
   - Monitor rate limit violations
   - Track failed email deliveries
   - Alert on suspicious activity

3. **Regular Audits**:
   - Review access logs
   - Check for unusual patterns
   - Verify email delivery rates

## Troubleshooting

### Common Issues

1. **Email Not Sending**:
   - Check SMTP configuration
   - Verify network connectivity
   - Check email service credentials

2. **Rate Limiting Too Strict**:
   - Adjust rate limit settings in `auth.json`
   - Monitor legitimate user activity

3. **Password Policy Too Strict**:
   - Modify password policy in `auth.json`
   - Consider user experience vs security

4. **JWT Token Issues**:
   - Verify JWT secret is set correctly
   - Check token expiration settings

### Debug Mode

Enable debug logging for troubleshooting:

```bash
export DEBUG=canvas-server:auth,canvas-server:email
npm run dev
```

## API Reference

### Authentication Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Register new user |
| `/api/auth/login` | POST | User login |
| `/api/auth/request-email-verification` | POST | Request email verification |
| `/api/verify-email/:token` | POST | Verify email with token |
| `/api/auth/forgot-password` | POST | Request password reset |
| `/api/reset-password` | POST | Reset password with token |

### Response Formats

#### Success Response
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "name": "username",
      "email": "user@example.com",
      "emailVerified": true,
      "status": "active"
    }
  },
  "message": "Operation successful"
}
```

#### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": ["Detailed error messages"]
}
```

## Migration Guide

### From Previous Version

1. **Backup Existing Data**:
   ```bash
   cp -r server/ server-backup/
   ```

2. **Update Configuration**:
   - Copy new configuration files
   - Update existing settings

3. **Test Email System**:
   ```bash
   node scripts/test-email-verification.js
   ```

4. **Enable Features Gradually**:
   - Start with email verification disabled
   - Test thoroughly before enabling
   - Monitor user experience

## Support

For security-related issues or questions:

1. Check the [SECURITY.md](../SECURITY.md) file
2. Review the troubleshooting section
3. Enable debug logging for detailed information
4. Contact the development team

## Contributing

When contributing to security features:

1. Follow security best practices
2. Include comprehensive tests
3. Document security implications
4. Review with security team
5. Test thoroughly before deployment