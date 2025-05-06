// tests/authStorageTest.js
import { createUser, verifyUserPassword } from '../src/services/auth/lib/userService.js';
import { createApiToken, verifyApiToken } from '../src/services/auth/lib/tokenService.js';

(async () => {
    const email = 'test@example.com';
    const password = 'securePassword123';
    const apiToken = 'canvas-1234567890abcdef';

    // Test user creation and verification
    await createUser(email, password);
    const user = await verifyUserPassword(email, password);
    console.log('User verification:', user ? 'Success' : 'Failed');

    // Test API token creation and verification
    await createApiToken(email, apiToken);
    const tokenUser = await verifyApiToken(apiToken);
    console.log('API Token verification:', tokenUser ? 'Success' : 'Failed');
})();
