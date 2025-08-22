# WebSocket Real-time Integration

## Overview

The SUT Court Queue system implements comprehensive WebSocket integration for real-time updates across all connected clients. This document outlines the implementation details and usage patterns.

## Architecture

### Server-Side Components

1. **Socket Service** (`src/services/socketService.ts`)
   - Manages Socket.IO instance
   - Handles room-based broadcasting
   - Provides typed emit functions

2. **Socket Handlers** (`src/services/socketHandlers.ts`)
   - Processes incoming WebSocket events
   - Validates data and handles errors
   - Integrates with database operations

3. **API Integration**
   - All API endpoints emit corresponding WebSocket events
   - Real-time updates for queue, match, and court status changes

### Client-Side Components

1. **Socket Hook** (`client/src/hooks/useSocket.ts`)
   - Manages WebSocket connection
   - Handles reconnection logic
   - Provides typed event handlers

2. **Socket Context** (`client/src/contexts/SocketContext.tsx`)
   - Provides global socket access
   - Manages connection state
   - Handles error propagation

## Event Types

### Client to Server Events

```typescript
// Join queue
socket.emit('join-queue', {
  teamName: string,
  members: number,
  contactInfo?: string
});

// Confirm match result
socket.emit('confirm-result', {
  matchId: string,
  teamId: string,
  confirmed: boolean
});

// Admin actions
socket.emit('admin-action', {
  action: string,
  payload: any,
  adminId: string
});

// Room management
socket.emit('join-room', { room: string });
socket.emit('leave-room', { room: string });
```

### Server to Client Events

```typescript
// Queue updates
socket.on('queue-updated', (data: QueueUpdateData) => {
  // Handle queue changes
});

// Match updates
socket.on('match-updated', (data: MatchUpdateData) => {
  // Handle match state changes
});

// Court status updates
socket.on('court-status', (data: CourtStatusData) => {
  // Handle court status changes
});

// Notifications
socket.on('notification', (data: NotificationData) => {
  // Handle system notifications
});

// Errors
socket.on('error', (data: SocketErrorData) => {
  // Handle socket errors
});
```

## Real-time Update Integration

### Queue Operations

When teams join or leave the queue via API endpoints:

```typescript
// API endpoint emits real-time update
emitQueueUpdate({
  teams: updatedQueueState.teams,
  totalTeams: updatedQueueState.teams.length,
  availableSlots: updatedQueueState.maxSize - updatedQueueState.teams.length,
  event: 'team_joined'
});
```

### Match Operations

When match scores are updated or matches are completed:

```typescript
// API endpoint emits match update
emitMatchUpdate({
  match: updatedMatch,
  event: 'score_updated',
  score: `${score1}-${score2}`
});
```

### Court Status Changes

When admin updates court status:

```typescript
// Court service emits status update
emitCourtStatusUpdate({
  isOpen: courtStatus.isOpen,
  currentTime: new Date().toISOString(),
  timezone: courtStatus.timezone,
  mode: courtStatus.mode,
  activeMatches: activeMatches.length
});
```

## Error Handling and Reconnection

### Server-Side Error Handling

- Input validation with Zod schemas
- Structured error responses
- Graceful error propagation to clients

```typescript
const error: SocketErrorData = {
  code: 'VALIDATION_ERROR',
  message: 'Invalid queue join data',
  details: validationResult.error.errors
};
emitError(socket, error);
```

### Client-Side Reconnection Logic

- Automatic reconnection with exponential backoff
- Connection status tracking
- Event listener cleanup on disconnect

```typescript
const socket = io(serverUrl, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});
```

## Room-Based Broadcasting

### Room Types

- `public`: All general users and spectators
- `admin`: Administrative users only
- `match`: Match-specific updates

### Usage

```typescript
// Emit to specific room
emitQueueUpdate(data, ROOMS.PUBLIC);
emitMatchUpdate(data, ROOMS.MATCH);

// Join/leave rooms
socket.join(ROOMS.ADMIN);
socket.leave(ROOMS.PUBLIC);
```

## Testing

### Integration Tests

Run WebSocket integration tests:

```bash
npm test -- websocket-integration.test.ts
```

### Demo Server

Start demo server for testing:

```bash
# Terminal 1: Start demo server
npm run demo:server

# Terminal 2: Connect demo client
npm run demo:client
```

## Performance Considerations

### Connection Management

- Automatic cleanup of disconnected clients
- Room-based broadcasting to reduce unnecessary traffic
- Connection pooling for high-traffic scenarios

### Event Throttling

- Rate limiting on socket events
- Debounced updates for rapid changes
- Efficient data serialization

## Security

### Authentication

- JWT token validation for admin events
- Room-based access control
- Input sanitization and validation

### Rate Limiting

- Per-socket event rate limiting
- Connection attempt throttling
- Payload size restrictions

## Monitoring

### Connection Statistics

```typescript
const stats = getConnectionStats();
console.log('Connected clients:', stats.total);
console.log('Room distribution:', stats.rooms);
```

### Event Logging

- All socket events are logged with timestamps
- Error tracking and alerting
- Performance metrics collection

## Usage Examples

### Frontend Integration

```typescript
// In React component
const { onQueueUpdate, onMatchUpdate, joinQueue } = useSocketContext();

useEffect(() => {
  onQueueUpdate((data) => {
    setQueueData(data);
  });
  
  onMatchUpdate((data) => {
    setMatchData(data);
  });
}, [onQueueUpdate, onMatchUpdate]);

// Join queue
const handleJoinQueue = () => {
  joinQueue(teamName, memberCount, contactInfo);
};
```

### Backend Integration

```typescript
// In API route
router.post('/queue/join', async (req, res) => {
  // ... business logic ...
  
  // Emit real-time update
  emitQueueUpdate({
    teams: updatedTeams,
    totalTeams: updatedTeams.length,
    availableSlots: maxSize - updatedTeams.length,
    event: 'team_joined'
  });
  
  res.json({ success: true, data: newTeam });
});
```

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check server URL configuration
   - Verify CORS settings
   - Ensure Socket.IO versions match

2. **Event Not Received**
   - Verify event name spelling
   - Check room membership
   - Confirm client is connected

3. **Performance Issues**
   - Monitor connection count
   - Check for memory leaks
   - Optimize event payload size

### Debug Mode

Enable debug logging:

```bash
DEBUG=socket.io* npm run dev
```

## Future Enhancements

- WebSocket clustering for horizontal scaling
- Message persistence for offline clients
- Advanced room management features
- Real-time analytics dashboard