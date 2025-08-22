import { io } from 'socket.io-client';

// Connect to demo server
const socket = io('http://localhost:5001');

console.log('🔌 Connecting to WebSocket demo server...');

// Connection events
socket.on('connect', () => {
  console.log('✅ Connected to server:', socket.id);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
});

socket.on('connect_error', (error) => {
  console.error('🔌 Connection error:', error.message);
});

// Listen for real-time updates
socket.on('queue-updated', (data) => {
  console.log('📋 Queue Update:', {
    totalTeams: data.totalTeams,
    availableSlots: data.availableSlots,
    event: data.event
  });
});

socket.on('match-updated', (data) => {
  console.log('🏀 Match Update:', {
    event: data.event,
    score: data.score,
    teams: `${data.match.team1.name} vs ${data.match.team2.name}`,
    matchScore: `${data.match.score1}-${data.match.score2}`
  });
});

socket.on('court-status', (data) => {
  console.log('🏟️ Court Status:', {
    isOpen: data.isOpen,
    mode: data.mode,
    activeMatches: data.activeMatches,
    time: new Date(data.currentTime).toLocaleTimeString()
  });
});

socket.on('notification', (data) => {
  console.log(`📢 ${data.type.toUpperCase()}: ${data.title} - ${data.message}`);
});

socket.on('error', (data) => {
  console.error('❌ Socket Error:', data);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Disconnecting from server...');
  socket.disconnect();
  process.exit(0);
});