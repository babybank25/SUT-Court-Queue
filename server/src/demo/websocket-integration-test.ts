#!/usr/bin/env ts-node

/**
 * WebSocket Integration Test
 * This script tests the WebSocket functionality by connecting to the server
 * and verifying that events are properly handled.
 */

import { io, Socket } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

async function testWebSocketIntegration() {
  console.log('🧪 Starting WebSocket Integration Test...');
  console.log(`📡 Connecting to: ${SERVER_URL}`);

  const client: Socket = io(SERVER_URL, {
    autoConnect: true,
    timeout: 5000
  });

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.disconnect();
      reject(new Error('Test timeout after 10 seconds'));
    }, 10000);

    let testsCompleted = 0;
    const totalTests = 4;

    function checkCompletion() {
      testsCompleted++;
      if (testsCompleted >= totalTests) {
        clearTimeout(timeout);
        client.disconnect();
        console.log('✅ All WebSocket integration tests passed!');
        resolve();
      }
    }

    // Test 1: Connection
    client.on('connect', () => {
      console.log('✅ Test 1: Successfully connected to server');
      console.log(`   Socket ID: ${client.id}`);
      checkCompletion();
    });

    // Test 2: Room joining
    client.on('notification', (data) => {
      if (data.title === 'Room Joined') {
        console.log('✅ Test 2: Successfully joined room');
        console.log(`   Message: ${data.message}`);
        checkCompletion();
      }
    });

    // Test 3: Error handling
    client.emit('join-room', { room: 'invalid-room' });
    client.on('error', (error) => {
      if (error.code === 'INVALID_ROOM') {
        console.log('✅ Test 3: Error handling works correctly');
        console.log(`   Error: ${error.message}`);
        checkCompletion();
      }
    });

    // Test 4: Valid room joining
    setTimeout(() => {
      client.emit('join-room', { room: 'public' });
    }, 1000);

    client.on('connect_error', (error) => {
      clearTimeout(timeout);
      client.disconnect();
      reject(new Error(`Connection failed: ${error.message}`));
    });

    client.on('disconnect', (reason) => {
      console.log(`🔌 Disconnected: ${reason}`);
    });
  });
}

// Run the test
if (require.main === module) {
  testWebSocketIntegration()
    .then(() => {
      console.log('🎉 WebSocket integration test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ WebSocket integration test failed:', error.message);
      process.exit(1);
    });
}

export { testWebSocketIntegration };