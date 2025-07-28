# Canvas Server Security Guide

## Overview

This document outlines the security features implemented in Canvas Server and provides best practices for secure deployment.

## Security Features Implemented

### 1. Authentication Security

#### Password Policy
- **Minimum Length**: 12 characters (configurable)
- **Complexity Requirements**: 
  - Uppercase letters (A-Z)
  - Lowercase letters (a-z)
  - Numbers (0-9)
  - Special characters (!@#$%^&*()_+-=[]{}|;':",./<>?)
- **Weak Password Detection**: Blocks common weak passwords
- **Maximum Length**: 128 characters

#### JWT Token Security
- **Secure Secret Generation**: Uses crypto.randomBytes(64) for JWT secrets
- **Token Expiration**: Configurable expiration (default: 1 day)
- **Token Versioning**: Includes user version for invalidation on data changes
- **Secret Validation**: Warns about insecure default secrets

#### API Token Security
- **Secure Generation**: Uses crypto.randomBytes(24) for token values
- **SHA-256 Hashing**: Tokens are stored as SHA-256 hashes
- **Expiration Support**: Configurable token expiration
- **Prefix Identification**: API tokens use "canvas-" prefix

### 2. Email Verification

#### Toggleable Email Verification
- **Configuration**: Enable/disable via `server/config/auth.json`
- **User Status**: Pending users cannot log in until verified
- **Token Expiration**: 48-hour expiration for verification tokens
- **Email Templates**: Configurable HTML and text templates

#### SMTP Configuration
- **Flexible Setup**: Supports custom SMTP or system sendmail
- **Fallback Support**: Automatic fallback to system SMTP
- **Template Variables**: Support for dynamic content in emails

### 3. Rate Limiting

#### Login Protection
- **Max Attempts**: 5 attempts per 15 minutes (configurable)
- **Lockout Duration**: 30 minutes after max attempts
- **IP-based Tracking**: Rate limiting by IP address

#### Registration Protection
- **Max Attempts**: 3 attempts per hour (configurable)
- **Prevents Abuse**: Protects against automated registration

### 4. Input Validation & Sanitization

#### Email Validation
- **Format Validation**: RFC-compliant email format checking
- **Sanitization**: Automatic lowercase conversion and trimming
- **Domain Validation**: IMAP domain-specific validation

#### Username Validation
- **Format**: 3-39 characters, lowercase letters, numbers, underscores, hyphens, dots
- **Reserved Names**: Blocks system-reserved usernames
- **Pattern Matching**: Strict regex validation

### 5. Security Headers

#### HTTP Security Headers
- **X-Content-Type-Options**: nosniff
- **X-Frame-Options**: DENY
- **X-XSS-Protection**: 1; mode=block
- **Referrer-Policy**: strict-origin-when-cross-origin
- **Permissions-Policy**: Restricts geolocation, microphone, camera
- **Content-Security-Policy**: Comprehensive CSP rules
- **HSTS**: HTTP Strict Transport Security (production only)

### 6. Error Handling

#### Information Disclosure Prevention
- **Generic Messages**: Login errors don't reveal user existence
- **Sanitized Errors**: No sensitive data in error responses
- **Logging**: Secure logging without sensitive data exposure

## Configuration Files

### server/config/auth.json
```json
{
  "strategies": {
    "local": {
      "enabled": true,
      "requireEmailVerification": false,
      "passwordPolicy": {
        "minLength": 12,
        "requireUppercase": true,
        "requireLowercase": true,
        "requireNumbers": true,
        "requireSpecialChars": true,
        "maxLength": 128
      },
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
  },
  "jwt": {
    "secret": "your-secure-jwt-secret-here",
    "expiresIn": "1d"
  }
}
```

### server/config/smtp.json
```json
{
  "enabled": true,
  "host": "smtp.example.com",
  "port": 587,
  "secure": true,
  "auth": {
    "user": "your-email@example.com",
    "pass": "your-password"
  },
  "from": {
    "name": "Canvas Server",
    "email": "noreply@example.com"
  }
}
```

## Deployment Security Checklist

### 1. Environment Variables
- [ ] Set `CANVAS_JWT_SECRET` to a secure random value
- [ ] Set `NODE_ENV=production` for production deployments
- [ ] Configure `CANVAS_WEB_URL` for proper email links
- [ ] Set secure admin credentials via environment variables

### 2. JWT Secret Security
- [ ] Generate a secure JWT secret: `node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"`
- [ ] Update `server/config/auth.json` with the generated secret
- [ ] Never use the default secret in production

### 3. SMTP Configuration
- [ ] Configure SMTP settings in `server/config/smtp.json`
- [ ] Test email delivery before enabling email verification
- [ ] Use TLS/SSL for SMTP connections
- [ ] Consider using dedicated email service (SendGrid, Mailgun, etc.)

### 4. Network Security
- [ ] Use HTTPS in production
- [ ] Configure reverse proxy (nginx, Apache) with security headers
- [ ] Set up firewall rules to restrict access
- [ ] Use VPN for admin access if needed

### 5. Database Security
- [ ] Secure the underlying data storage (jim database)
- [ ] Regular backups with encryption
- [ ] Access control for database files
- [ ] Monitor for unauthorized access

### 6. Monitoring & Logging
- [ ] Enable security event logging
- [ ] Monitor failed login attempts
- [ ] Set up alerts for suspicious activity
- [ ] Regular security audits

## Security Best Practices

### 1. Regular Updates
- Keep Node.js and dependencies updated
- Monitor security advisories
- Apply security patches promptly

### 2. Access Control
- Use strong, unique passwords
- Enable email verification for critical accounts
- Implement role-based access control
- Regular access reviews

### 3. Data Protection
- Encrypt sensitive data at rest
- Use secure communication protocols
- Implement data retention policies
- Regular data backups

### 4. Incident Response
- Document security incident procedures
- Have contact information for security team
- Regular security training for users
- Test incident response procedures

## Security Testing

### 1. Penetration Testing
- Regular security assessments
- Vulnerability scanning
- Code security reviews
- Third-party security audits

### 2. Automated Testing
- Security unit tests
- Integration security tests
- Automated vulnerability scanning
- Continuous security monitoring

## Reporting Security Issues

If you discover a security vulnerability in Canvas Server:

1. **Do not** create a public issue
2. Email security details to: security@canvas.local
3. Include detailed reproduction steps
4. Allow time for investigation and fix
5. Coordinate disclosure timeline

## Compliance

This implementation supports:
- **OWASP Top 10** security controls
- **GDPR** data protection requirements
- **SOC 2** security controls
- **ISO 27001** information security standards

## Additional Resources

- [OWASP Security Guidelines](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [JWT Security Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
- [Email Security Best Practices](https://www.ietf.org/rfc/rfc5321.txt)