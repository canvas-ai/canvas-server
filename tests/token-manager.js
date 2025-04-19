// Test script for the simplified TokenManager
import server from '../src/Server.js';
import logger from '../src/utils/log/index.js';
import { getUserManager } from '../src/Server.js';
import TokenManager from '../src/managers/user/lib/TokenManager.js';
import Jim from '../src/utils/jim/index.js';

async function main() {
  try {
    logger.info('Testing simplified TokenManager implementation');

    // Initialize the server
    await server.init();

    // Get an existing user
    const userManager = getUserManager();
    const users = await userManager.listUsers({ limit: 1 });

    if (users.length === 0) {
      throw new Error('No users found - please create a user first');
    }

    const userId = users[0].id;
    logger.info(`Using user with ID: ${userId}`);

    // Create token manager instance
    const tokenManager = new TokenManager({
      userId,
      jim: userManager.jim
    });

    // Test creating a token
    logger.info('Creating a test token...');
    const token = await tokenManager.createToken({
      name: 'Test Token',
      description: 'Created for testing the simplified TokenManager',
      scopes: ['api', 'test']
    });

    logger.info(`Token created with ID: ${token.id}`);
    logger.info(`Token value: ${token.value}`);

    // Test listing tokens
    logger.info('Listing all tokens:');
    const tokens = await tokenManager.listTokens();
    logger.info(`Found ${tokens.length} tokens`);

    // Test getting token count
    const count = await tokenManager.getTokenCount();
    logger.info(`Token count: ${count}`);

    // Test updating token
    logger.info('Updating token...');
    const updatedToken = await tokenManager.updateToken(token.id, {
      description: 'Updated description for test token'
    });
    logger.info(`Token updated: ${updatedToken.description}`);

    // Test updating usage
    logger.info('Updating token usage...');
    const usageUpdatedToken = await tokenManager.updateTokenUsage(token.id);
    logger.info(`Token usage count: ${usageUpdatedToken.usageCount}`);

    // Test deleting token
    logger.info('Deleting token...');
    const deleteResult = await tokenManager.deleteToken(token.id);
    logger.info(`Token deletion result: ${deleteResult}`);

    // Verify token is deleted
    const afterDeleteCount = await tokenManager.getTokenCount();
    logger.info(`Token count after deletion: ${afterDeleteCount}`);

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
