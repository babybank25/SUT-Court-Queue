import { createServer } from 'http';
import { Server } from 'socket.io';
import { setSocketInstance, emitQueueUpdate, emitMatchUpdate, emitCourtStatusUpdate } from '../services/socketService';

// Create a simple demo server to test WebSocket functionality
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize socket service
setSocketInstance(io);

// Handle connections
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  
  // Join public room
  socket.join('public');
  
  // Send welcome message
  socket.emit('notification', {
    type: 'info',
    title: 'Connected',
    message: 'Successfully connected to SUT Court Queue server',
    timestamp: new Date().toISOString(),
    duration: 3000
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = 5001;
httpServer.listen(PORT, () => {
  console.log(`🚀 WebSocket Demo Server running on port ${PORT}`);
  console.log(`📱 Connect with: http://localhost:${PORT}`);
  
  // Demo real-time updates every 5 seconds
  let counter = 0;
  setInterval(() => {
    counter++;
    
    // Demo queue update
    emitQueueUpdate({
      teams: [],
      totalTeams: counter % 5,
      availableSlots: 10 - (counter % 5),
      event: 'demo_update'
    });
    
    // Demo match update every 10 seconds
    if (counter % 2 === 0) {
      emitMatchUpdate({
        match: {
          id: 'demo-match',
          team1: { id: '1', name: 'Team Alpha', members: 5, status: 'playing', wins: 2, lastSeen: new Date() },
          team2: { id: '2', name: 'Team Beta', members: 5, status: 'playing', wins: 1, lastSeen: new Date() },
          score1: Math.floor(Math.random() * 21),
          score2: Math.floor(Math.random() * 21),
          status: 'active',
          startTime: new Date(Date.now() - 300000), // 5 minutes ago
          targetScore: 21,
          matchType: 'regular',
          confirmed: { team1: false, team2: false }
        },
        event: 'score_updated',
        score: `${Math.floor(Math.random() * 21)}-${Math.floor(Math.random() * 21)}`
      });
    }
    
    // Demo court status update every 15 seconds
    if (counter % 3 === 0) {
      emitCourtStatusUpdate({
        isOpen: Math.random() > 0.3,
        currentTime: new Date().toISOString(),
        timezone: 'Asia/Bangkok',
        mode: Math.random() > 0.5 ? 'regular' : 'champion-return',
        activeMatches: Math.floor(Math.random() * 3)
      });
    }
    
    console.log(`📡 Demo update ${counter} sent to all connected clients`);
  }, 5000);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down WebSocket demo server...');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});