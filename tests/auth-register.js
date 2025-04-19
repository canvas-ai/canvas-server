// Test script for user registration
import server from '../src/Server.js';
import logger from '../src/utils/log/index.js';

// Random email for testing
const testEmail = `test${Date.now()}@example.com`;
const testPassword = 'Password123!';

async function main() {
  try {
    logger.info(`Testing user registration with email: ${testEmail}`);

    // Initialize the server singleton
    await server.init();
    await server.start();

    // Get the auth service
    const authService = server.services.get('auth');
    if (!authService) {
      throw new Error('Auth service not found');
    }

    // Register a new user
    logger.info('Attempting to register user...');
    const result = await authService.register(testEmail, testPassword);

    logger.info(`User registered successfully: ${result.user.id}`);
    logger.info(`User email: ${result.user.email}`);
    logger.info(`User JWT token: ${result.token}`);

    // Shut down server
    await server.stop(false);

    logger.info('Test completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error(`Test failed: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

main();
