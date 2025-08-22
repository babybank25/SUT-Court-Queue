# Socket.IO Client Integration

This directory contains the complete Socket.IO client integration for the SUT Court Queue system. The implementation provides real-time communication between the client and server with comprehensive error handling, connection management, and data synchronization.

## Architecture Overview

The Socket.IO client integration consists of several layers:

1. **Core Socket Hook** (`useSocket.ts`) - Low-level Socket.IO connection management
2. **Connection Management** (`useSocketConnection.ts`) - Enhanced connection handling with error recovery
3. **Error Handling** (`useSocketErrorHandler.ts`) - Centralized error and notification handling
4. **Real-time Data Hooks** - Specialized hooks for different data types
5. **Context Providers** - React context for global state management

## Core Components

### useSocket Hook

The main hook that manages the Socket.IO connection:

```typescript
const {
  socket,
  isConnected,
  connectionError,
  emit,
  on,
  off,
  reconnect,
  // Typed event handlers
  onQueueUpdate,
  onMatchUpdate,
  onCourtStatus,
  onNotification,
  onError,
  // Convenience methods
  joinQueue,
  confirmResult,
  joinRoom,
  leaveRoom
} = useSocket({
  serverUrl: 'http://localhost:5000',
  autoConnect: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});
```

**Features:**
- Automatic connection management
- Reconnection with exponential backoff
- Typed event handlers for type safety
- Connection status tracking
- Error handling and logging
- Room management
- Convenience methods for common actions

### useSocketConnection Hook

Enhanced connection management with application-level integration:

```typescript
const {
  isConnected,
  emit,
  joinRoom,
  leaveRoom,
  reconnect,
  isReady
} = useSocketConnection({
  autoJoinRooms: ['public'],
  onConnect: () => console.log('Connected!'),
  onDisconnect: () => console.log('Disconnected!'),
  onError: (error) => console.error('Connection error:', error)
});
```

**Features:**
- Automatic room joining on connection
- Integration with global app state
- Enhanced error handling with user feedback
- Connection status management
- Loading state management

### useSocketErrorHandler Hook

Centralized error and notification handling:

```typescript
useSocketErrorHandler({
  showToasts: true,
  logErrors: true,
  onError: (error) => {
    // Custom error handling
  },
  onNotification: (notification) => {
    // Custom notification handling
  }
});
```

**Features:**
- Automatic error categorization
- User-friendly error messages
- Toast notification integration
- Logging control
- Custom error handlers

## Real-time Data Hooks

### useRealtimeQueue

Manages queue data with real-time updates:

```typescript
const {
  queueData,
  isLoading,
  error,
  refetch,
  getTeamPosition,
  getWaitingTeams,
  hasTeams,
  isQueueFull
} = useRealtimeQueue({
  onQueueUpdate: (data) => {
    console.log('Queue updated:', data);
  }
});
```

### useRealtimeMatch

Manages match data with real-time updates:

```typescript
const {
  currentMatch,
  isLoading,
  error,
  refetch,
  getMatchDuration,
  getWinningTeam,
  isMatchActive,
  isAwaitingConfirmation
} = useRealtimeMatch({
  onMatchUpdate: (data) => {
    console.log('Match updated:', data);
  }
});
```

### useRealtimeCourtStatus

Manages court status with real-time updates:

```typescript
const {
  courtStatus,
  isLoading,
  error,
  refetch,
  getCurrentTime,
  getFormattedTime,
  isCourtOpen,
  isInCooldown
} = useRealtimeCourtStatus({
  onCourtStatusUpdate: (data) => {
    console.log('Court status updated:', data);
  }
});
```

## Context Providers

### SocketProvider

Provides Socket.IO functionality throughout the app:

```typescript
<SocketProvider serverUrl="http://localhost:5000">
  <App />
</SocketProvider>
```

### RealtimeDataProvider

Manages real-time data synchronization:

```typescript
<RealtimeDataProvider>
  <YourComponent />
</RealtimeDataProvider>
```

## Event Types

The system handles the following WebSocket events:

### Client to Server Events
- `join-queue` - Team joins the queue
- `confirm-result` - Confirm match result
- `admin-action` - Admin performs an action
- `join-room` - Join a specific room
- `leave-room` - Leave a specific room

### Server to Client Events
- `queue-updated` - Queue state changed
- `match-updated` - Match state changed
- `court-status` - Court status changed
- `notification` - System notification
- `error` - Error occurred

## Error Handling

The system provides comprehensive error handling:

### Error Types
- `VALIDATION_ERROR` - Invalid input data
- `TEAM_NAME_EXISTS` - Team name already taken
- `QUEUE_FULL` - Queue is at capacity
- `MATCH_NOT_FOUND` - Match doesn't exist
- `MATCH_NOT_CONFIRMING` - Match not in confirmation state
- `TEAM_NOT_IN_MATCH` - Team not part of the match
- `INTERNAL_ERROR` - Server error
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INVALID_ROOM` - Invalid room name
- `UNKNOWN_ACTION` - Unknown admin action

### Notification Types
- `success` - Success message
- `error` - Error message
- `warning` - Warning message
- `info` - Information message

## Usage Examples

### Basic Setup

```typescript
import { SocketProvider, RealtimeDataProvider } from './contexts';
import { useSocketConnection } from './hooks';

function App() {
  return (
    <SocketProvider>
      <RealtimeDataProvider>
        <YourApp />
      </RealtimeDataProvider>
    </SocketProvider>
  );
}

function YourComponent() {
  const { isConnected, emit } = useSocketConnection();
  
  const handleJoinQueue = () => {
    emit('join-queue', {
      teamName: 'My Team',
      members: 3,
      contactInfo: 'test@example.com'
    });
  };
  
  return (
    <div>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <button onClick={handleJoinQueue}>Join Queue</button>
    </div>
  );
}
```

### Advanced Usage with Error Handling

```typescript
import { useSocketConnection, useSocketErrorHandler, useRealtimeQueue } from './hooks';

function QueueComponent() {
  const { emit, isConnected } = useSocketConnection();
  
  useSocketErrorHandler({
    showToasts: true,
    onError: (error) => {
      if (error.code === 'QUEUE_FULL') {
        alert('Queue is full! Please try again later.');
      }
    }
  });
  
  const { queueData, hasTeams } = useRealtimeQueue();
  
  return (
    <div>
      <h2>Queue Status</h2>
      <p>Teams in queue: {queueData.totalTeams}</p>
      <p>Available slots: {queueData.availableSlots}</p>
      
      {hasTeams && (
        <ul>
          {queueData.teams.map(team => (
            <li key={team.id}>
              {team.name} - {team.members} members
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

## Testing

The integration includes comprehensive tests:

```bash
# Run Socket.IO integration tests
npm test -- --testPathPattern="useSocket.integration.test.ts"

# Run all hook tests
npm test -- --testPathPattern="hooks"
```

## Demo Component

A complete demo component (`SocketDemo.tsx`) is available that showcases all features:

- Connection status display
- Real-time data visualization
- Queue joining functionality
- Match confirmation
- Room management
- Event logging
- Error handling demonstration

## Configuration

### Environment Variables

```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

### Socket.IO Options

The client can be configured with various options:

```typescript
const socketOptions = {
  serverUrl: process.env.VITE_SOCKET_URL,
  autoConnect: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000
};
```

## Best Practices

1. **Always check connection status** before emitting events
2. **Use typed event handlers** for type safety
3. **Handle errors gracefully** with user-friendly messages
4. **Clean up event listeners** when components unmount
5. **Use the convenience methods** for common operations
6. **Monitor connection status** and provide user feedback
7. **Test real-time functionality** thoroughly
8. **Handle offline scenarios** appropriately

## Troubleshooting

### Common Issues

1. **Connection fails**: Check server URL and CORS settings
2. **Events not received**: Verify room membership and event names
3. **Memory leaks**: Ensure proper cleanup of event listeners
4. **Type errors**: Use the provided TypeScript interfaces
5. **Reconnection issues**: Check network connectivity and server status

### Debug Mode

Enable debug logging:

```typescript
const { socket } = useSocket({ 
  serverUrl: 'http://localhost:5000',
  debug: true 
});
```

This will log all Socket.IO events and connection status changes to the console.