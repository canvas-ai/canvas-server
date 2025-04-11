/**
 * Test WebSocket and REST API integration
 *
 * This test script:
 * 1. Creates a WebSocket connection and subscribes to a workspace
 * 2. Uses the REST API to make changes to the workspace
 * 3. Verifies that the WebSocket client receives notifications about these changes
 */

// Include required modules
import { io } from 'socket.io-client';
import axios from 'axios';

// Configuration
const API_URL = 'http://localhost:8001';
const API_REST_BASE = `${API_URL}/rest/v2`;
const WS_URL = API_URL;

// Authentication - replace with a valid token for your system
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU2YjgwZGU3LThkNjEtNGY2My1iMjU5LTlhOGRiMmY3MzlhZiIsImVtYWlsIjoibmV3dXNlckB0ZXN0LmNvbSIsInNlc3Npb25JZCI6IjhlYjdlZmQ1LTNhOWMtNDQwMC04MDQyLTc3OTk2MGE3ZjNkOCIsImlhdCI6MTc0MTY5NjA4MiwiZXhwIjoxNzQyMzAwODgyfQ.AMDZml1OFbHOmk1dIUgvnaWiD8TqjYb2Y-Wg2NeQUPY';

// Test configuration
const WORKSPACE_ID = 'universe'; // Use your actual workspace ID
const TEST_PATH = `/test/path-${Date.now()}`;

// Setup axios with auth
const api = axios.create({
  baseURL: API_REST_BASE,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Track received events
const receivedEvents = [];

// First ensure the user is initialized by making REST API calls
async function initializeUser() {
  try {
    console.log('Step 1: Getting current user information...');
    const userResponse = await api.get('/users/current');
    console.log(`User initialized: ${userResponse.data.payload.email}`);

    console.log('Step 2: Getting workspace information...');
    const workspacesResponse = await api.get('/workspaces');

    // Better debugging
    console.log('Workspaces Response:', JSON.stringify(workspacesResponse.data, null, 2));

    // Check that the response has status "success" and has a payload array
    if (workspacesResponse.data.status === 'success' && Array.isArray(workspacesResponse.data.payload)) {
      const workspaces = workspacesResponse.data.payload;
      console.log(`Found ${workspaces.length} workspaces:`);
      workspaces.forEach(w => console.log(`- ${w.id} (${w.name}) - ${w.status}`));

      // Verify the test workspace exists
      const testWorkspace = workspaces.find(w => w.id === WORKSPACE_ID);
      if (testWorkspace) {
        console.log(`Target workspace "${WORKSPACE_ID}" found with status: ${testWorkspace.status}`);
        return true;
      } else {
        console.error(`Target workspace "${WORKSPACE_ID}" not found! Available workspaces:`, workspaces.map(w => w.id));
        return false;
      }
    } else {
      console.error('Failed to get workspaces list or invalid response format:', workspacesResponse.data.message);
      return false;
    }
  } catch (error) {
    console.error('Error initializing user:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return false;
  }
}

// Create a socket connection
async function startTest() {
  // First initialize the user
  console.log('\n=== INITIALIZATION ===');
  const userInitialized = await initializeUser();
  if (!userInitialized) {
    console.error('User initialization failed, aborting test');
    process.exit(1);
  }

  console.log('\n=== WEBSOCKET CONNECTION ===');
  console.log(`Connecting to WebSocket server at ${WS_URL}`);

  // Show the token being used (mask part of it for security)
  const maskedToken = AUTH_TOKEN.substring(0, 15) + '...' + AUTH_TOKEN.substring(AUTH_TOKEN.length - 10);
  console.log(`Using authentication token: ${maskedToken}`);

  const socket = io(WS_URL, {
    transports: ['websocket'],
    reconnectionAttempts: 3,
    timeout: 10000,
    auth: {
      token: AUTH_TOKEN
    },
    // Add more debug options
    debug: true
  });

  // Handle connection errors
  socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error.message);
    console.error('Error details:', error);
    cleanup(socket, 1);
  });

  // Handle authentication errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
    cleanup(socket, 1);
  });

  // Set up event listeners
  socket.on('connect', () => {
    console.log(`Connected to WebSocket server with socket ID: ${socket.id}`);

    // Get auth status if available
    if (socket.auth) {
      console.log('Authentication status:', socket.auth);
    }

    // After connected, subscribe to workspace
    console.log('\n=== SUBSCRIBING TO WORKSPACE ===');
    console.log(`Subscribing to workspace: ${WORKSPACE_ID}`);

    socket.emit('workspace:subscribe', WORKSPACE_ID, (response) => {
      console.log('Subscription response:', response);

      if (response && response.status === 'success') {
        console.log(`Successfully subscribed to workspace: ${WORKSPACE_ID}`);
        console.log('Workspace data:', response.payload);

        // Listen for tree updates
        socket.on('workspace:workspace:tree:updated', (event) => {
          console.log('\n=== RECEIVED TREE UPDATE EVENT ===');
          console.log('Event data:', event);
          receivedEvents.push({ type: 'tree:updated', data: event });

          if (event.data && event.data.operation === 'insertPath' && event.data.path === TEST_PATH) {
            console.log('✅ TEST PASSED: Received correct tree:updated event for insertPath');
            cleanup(socket, 0);
          }
        });

        // Set up all relevant event listeners
        setupAllListeners(socket);

        // After a short delay, make the REST API call
        setTimeout(() => makeRestApiCall(socket), 1000);
      } else {
        console.error(`Failed to subscribe to workspace:`, response);
        if (response && response.message) {
          console.error('Error message:', response.message);
        }
        cleanup(socket, 1);
      }
    });
  });
}

// Set up all relevant event listeners
function setupAllListeners(socket) {
  const events = [
    'workspace:workspace:layer:created',
    'workspace:workspace:layer:updated',
    'workspace:workspace:layer:renamed',
    'workspace:workspace:layer:deleted',
    'workspace:workspace:status:changed',
    'workspace:workspace:color:changed',
    'workspace:workspace:description:changed',
    'workspace:workspace:label:changed',
    'workspace:workspace:locked',
    'workspace:workspace:unlocked',
    'workspace:workspace:config:changed'
  ];

  events.forEach(event => {
    socket.on(event, (data) => {
      console.log(`Received event: ${event}`, data);
      receivedEvents.push({ type: event, data });
    });
  });
}

// Make the REST API call to insert a path
async function makeRestApiCall(socket) {
  try {
    console.log('\n=== MAKING REST API CALL ===');
    console.log(`Making REST API call to insert path: ${TEST_PATH}`);

    const response = await api.post(`/workspaces/${WORKSPACE_ID}/tree/path`, {
      path: TEST_PATH,
      autoCreateLayers: true
    });

    console.log('REST API call response:', response.data);

    // Set a timeout to check if we received the event
    setTimeout(() => checkResults(socket), 3000);
  } catch (error) {
    console.error('Error making REST API call:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    cleanup(socket, 1);
  }
}

// Check if we received the expected events
function checkResults(socket) {
  console.log('\n=== CHECKING RESULTS ===');
  console.log(`Received ${receivedEvents.length} events`);

  // Display all received events
  receivedEvents.forEach((event, index) => {
    console.log(`Event ${index + 1}: ${event.type}`);
  });

  const foundEvent = receivedEvents.some(event =>
    event.type === 'tree:updated' &&
    event.data.data &&
    event.data.data.operation === 'insertPath' &&
    event.data.data.path === TEST_PATH
  );

  if (foundEvent) {
    console.log('✅ TEST PASSED: Received correct tree:updated event');
  } else {
    console.log('❌ TEST FAILED: Did not receive expected tree:updated event');
  }

  cleanup(socket, foundEvent ? 0 : 1);
}

// Clean up resources
function cleanup(socket, exitCode = 0) {
  console.log('\n=== CLEANING UP ===');
  console.log('Disconnecting socket...');
  if (socket && socket.connected) {
    socket.disconnect();
  }

  console.log(`Exiting with code: ${exitCode}`);
  process.exit(exitCode);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nTest interrupted');
  process.exit(2);
});

// Set a global timeout
setTimeout(() => {
  console.log('\nTest timed out');
  process.exit(3);
}, 30000);

// Start the test
console.log('\n=== STARTING TEST ===');
console.log('Testing WebSocket and REST API integration');
console.log('-------------------------------------------');
startTest();
