import userService from '../../src/services/auth/lib/userService.js';
import tokenService from '../../src/services/auth/lib/tokenService.js';

async function testStorage() {
    console.log('Testing User Service...');

    // Create a test user
    const user = await userService.createUser({
        email: 'test@example.com',
        password: 'test123'
    });
    console.log('Created user:', user);

    // Get user by email
    const foundUser = await userService.getUserByEmail('test@example.com');
    console.log('Found user by email:', foundUser);

    // Update user
    const updatedUser = await userService.updateUser(user.id, {
        email: 'updated@example.com'
    });
    console.log('Updated user:', updatedUser);

    // Create API token
    const token = await tokenService.createToken(user.id, 'Test Token');
    console.log('Created token:', token);

    // Get token
    const foundToken = await tokenService.getToken(token.token);
    console.log('Found token:', foundToken);

    // Get user's tokens
    const userTokens = await tokenService.getTokensByUserId(user.id);
    console.log('User tokens:', userTokens);

    // Update token last used
    const updatedToken = await tokenService.updateTokenLastUsed(token.id);
    console.log('Updated token:', updatedToken);

    // Cleanup
    await tokenService.deleteToken(token.id);
    await userService.deleteUser(user.id);
    console.log('Cleanup completed');
}

testStorage().catch(console.error);
