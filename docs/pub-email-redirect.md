# Pub Routes Email-to-User-ID Redirection

## Overview

The pub routes now support automatic redirection from email-based URLs to user ID-based URLs. This allows users to access shared resources using email addresses instead of having to know the specific user ID.

## How It Works

When a request is made to a pub route with an email address as the `targetUserId` or `ownerUserId` parameter, the system:

1. Validates that the parameter is a valid email address using the `validator` library
2. Attempts to find a user with that email address using `userManager.getUserByEmail()`
3. If a user is found, redirects (HTTP 301) to the same URL with the user ID instead of the email
4. If no user is found or the parameter is not an email, continues with the original logic

## Supported Routes

All pub routes that use `targetUserId` or `ownerUserId` parameters now support email redirection:

- `GET /pub/:targetUserId/contexts/:contextId` - Get context
- `POST /pub/:ownerUserId/contexts/:contextId/shares` - Share context
- `DELETE /pub/:ownerUserId/contexts/:contextId/shares/:sharedWithUserId` - Revoke share
- `GET /pub/:targetUserId/contexts/:contextId/documents` - List documents
- `POST /pub/:targetUserId/contexts/:contextId/documents` - Insert documents
- `PUT /pub/:targetUserId/contexts/:contextId/documents` - Update documents
- `DELETE /pub/:targetUserId/contexts/:contextId/documents/remove` - Remove documents
- `DELETE /pub/:targetUserId/contexts/:contextId/documents` - Delete documents
- `GET /pub/:targetUserId/contexts/:contextId/documents/by-id/:docId` - Get document by ID

## Examples

### Before (User ID required)
```
GET /pub/abc123/contexts/myproject
```

### After (Email supported)
```
GET /pub/user@example.com/contexts/myproject
# Redirects to: GET /pub/abc123/contexts/myproject
```

### Before (User ID required)
```
POST /pub/def456/contexts/work/shares
```

### After (Email supported)
```
POST /pub/admin@company.com/contexts/work/shares
# Redirects to: POST /pub/def456/contexts/work/shares
```

## Implementation Details

### Helper Function

The redirection logic is implemented in the `resolveUserIdFromEmail` helper function:

```javascript
const resolveUserIdFromEmail = async (request, reply, targetUserId) => {
  // Check if targetUserId looks like an email
  if (!validator.isEmail(targetUserId)) {
    return null; // Not an email, return null to continue with original targetUserId
  }

  try {
    // Try to find user by email
    const user = await fastify.userManager.getUserByEmail(targetUserId);
    if (user && user.id) {
      // Redirect to the user ID-based URL
      const originalUrl = request.url;
      const newUrl = originalUrl.replace(`/${targetUserId}/`, `/${user.id}/`);
      
      fastify.log.info(`Redirecting email-based URL to user ID: ${originalUrl} -> ${newUrl}`);
      return reply.redirect(301, newUrl);
    }
  } catch (error) {
    // User not found by email, continue with original targetUserId
    fastify.log.debug(`User not found by email: ${targetUserId}`);
  }
  
  return null; // No redirect needed
};
```

### Integration

The helper function is called at the beginning of each route handler:

```javascript
// Check if targetUserId is an email and redirect if needed
const redirectResult = await resolveUserIdFromEmail(request, reply, request.params.targetUserId);
if (redirectResult) {
  return redirectResult; // Redirect has been sent
}
```

## Benefits

1. **User-Friendly URLs**: Users can share links using email addresses instead of cryptic user IDs
2. **Backward Compatibility**: Existing user ID-based URLs continue to work unchanged
3. **SEO Friendly**: Email-based URLs are more descriptive and memorable
4. **Automatic Resolution**: No manual lookup required - the system handles the conversion automatically

## Error Handling

- If an email is provided but no user is found, the request continues with the email as-is (which will likely result in a 404)
- If the email format is invalid, the request continues with the original parameter
- All existing error handling for invalid user IDs remains unchanged

## Testing

The functionality is tested in `tests/pub-email-redirect-test.js` which verifies:
- Email validation logic
- URL redirection construction
- Edge cases and error conditions 
