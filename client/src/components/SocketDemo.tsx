import React, { useState, useEffect } from 'react';
import { useSocketContext } from '../contexts/SocketContext';
import { useSocketConnection } from '../hooks/useSocketConnection';
import { useSocketErrorHandler } from '../hooks/useSocketErrorHandler';
import { useRealtimeQueue } from '../hooks/useRealtimeQueue';
import { useRealtimeMatch } from '../hooks/useRealtimeMatch';
import { useRealtimeCourtStatus } from '../hooks/useRealtimeCourtStatus';
import { ConnectionStatus } from './ConnectionStatus';

export const SocketDemo: React.FC = () => {
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState(3);
  const [contactInfo, setContactInfo] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  // Socket connection with error handling
  const { isConnected, emit, joinRoom, leaveRoom } = useSocketConnection({
    autoJoinRooms: ['public'],
    onConnect: () => addLog('✅ Connected to server'),
    onDisconnect: () => addLog('❌ Disconnected from server'),
    onError: (error) => addLog(`🚨 Connection error: ${error.message}`)
  });

  // Error handling
  useSocketErrorHandler({
    showToasts: true,
    onError: (error) => addLog(`🚨 Socket error: ${error.code} - ${error.message}`),
    onNotification: (notification) => addLog(`📢 ${notification.type}: ${notification.title} - ${notification.message}`)
  });

  // Real-time data hooks
  const { queueData, isLoading: queueLoading } = useRealtimeQueue({
    onQueueUpdate: (data) => addLog(`📋 Queue updated: ${data.totalTeams} teams, event: ${data.event || 'update'}`)
  });

  const { currentMatch, isLoading: matchLoading } = useRealtimeMatch({
    onMatchUpdate: (data) => addLog(`🏀 Match updated: ${data.event}, score: ${data.score || 'N/A'}`)
  });

  const { courtStatus, isLoading: courtLoading } = useRealtimeCourtStatus({
    onCourtStatusUpdate: (data) => addLog(`🏟️ Court status: ${data.isOpen ? 'Open' : 'Closed'}, mode: ${data.mode}`)
  });

  // Helper function to add logs
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]); // Keep last 50 logs
  };

  // Clear logs
  const clearLogs = () => setLogs([]);

  // Join queue handler
  const handleJoinQueue = () => {
    if (!teamName.trim()) {
      addLog('❌ Team name is required');
      return;
    }

    const success = emit('join-queue', {
      teamName: teamName.trim(),
      members,
      contactInfo: contactInfo.trim() || undefined
    });

    if (success) {
      addLog(`📤 Sent join queue request for "${teamName}"`);
      setTeamName('');
      setContactInfo('');
    }
  };

  // Confirm match result handler
  const handleConfirmResult = (confirmed: boolean) => {
    if (!currentMatch) {
      addLog('❌ No active match to confirm');
      return;
    }

    // For demo purposes, we'll use the first team's ID
    const teamId = currentMatch.team1.id;
    
    const success = emit('confirm-result', {
      matchId: currentMatch.id,
      teamId,
      confirmed
    });

    if (success) {
      addLog(`📤 Sent match confirmation: ${confirmed ? 'Confirmed' : 'Rejected'}`);
    }
  };

  // Room management handlers
  const handleJoinRoom = (room: string) => {
    const success = joinRoom(room);
    if (success) {
      addLog(`📤 Joined room: ${room}`);
    }
  };

  const handleLeaveRoom = (room: string) => {
    const success = leaveRoom(room);
    if (success) {
      addLog(`📤 Left room: ${room}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Socket.IO Client Integration Demo</h1>
        
        {/* Connection Status */}
        <div className="mb-4">
          <ConnectionStatus />
        </div>

        {/* Real-time Data Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800">Queue Status</h3>
            <p className="text-sm text-blue-600">
              {queueLoading ? 'Loading...' : `${queueData.totalTeams} teams in queue`}
            </p>
            <p className="text-xs text-blue-500">
              Available slots: {queueData.availableSlots}
            </p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-800">Match Status</h3>
            <p className="text-sm text-green-600">
              {matchLoading ? 'Loading...' : currentMatch ? `Active: ${currentMatch.team1.name} vs ${currentMatch.team2.name}` : 'No active match'}
            </p>
            {currentMatch && (
              <p className="text-xs text-green-500">
                Score: {currentMatch.score1}-{currentMatch.score2}
              </p>
            )}
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-semibold text-purple-800">Court Status</h3>
            <p className="text-sm text-purple-600">
              {courtLoading ? 'Loading...' : `${courtStatus.isOpen ? 'Open' : 'Closed'} - ${courtStatus.mode}`}
            </p>
            <p className="text-xs text-purple-500">
              Active matches: {courtStatus.activeMatches}
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Join Queue Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Join Queue</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Team Name *
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter team name"
                disabled={!isConnected}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Members
              </label>
              <select
                value={members}
                onChange={(e) => setMembers(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!isConnected}
              >
                {[1, 2, 3, 4, 5].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Info (Optional)
              </label>
              <input
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Phone or email"
                disabled={!isConnected}
              />
            </div>

            <button
              onClick={handleJoinQueue}
              disabled={!isConnected || !teamName.trim()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Join Queue
            </button>
          </div>
        </div>

        {/* Match Controls */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Match Controls</h2>
          
          {currentMatch ? (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-800">Current Match</h3>
                <p className="text-sm text-gray-600">
                  {currentMatch.team1.name} vs {currentMatch.team2.name}
                </p>
                <p className="text-sm text-gray-600">
                  Score: {currentMatch.score1}-{currentMatch.score2}
                </p>
                <p className="text-sm text-gray-600">
                  Status: {currentMatch.status}
                </p>
              </div>

              {currentMatch.status === 'confirming' && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Confirm match result:</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConfirmResult(true)}
                      disabled={!isConnected}
                      className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => handleConfirmResult(false)}
                      disabled={!isConnected}
                      className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:bg-gray-400 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">No active match</p>
          )}

          {/* Room Management */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="font-medium text-gray-800 mb-3">Room Management</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleJoinRoom('admin')}
                disabled={!isConnected}
                className="bg-purple-600 text-white py-2 px-3 rounded-md hover:bg-purple-700 disabled:bg-gray-400 text-sm transition-colors"
              >
                Join Admin
              </button>
              <button
                onClick={() => handleLeaveRoom('admin')}
                disabled={!isConnected}
                className="bg-gray-600 text-white py-2 px-3 rounded-md hover:bg-gray-700 disabled:bg-gray-400 text-sm transition-colors"
              >
                Leave Admin
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Event Logs */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Event Logs</h2>
          <button
            onClick={clearLogs}
            className="bg-gray-500 text-white py-1 px-3 rounded-md hover:bg-gray-600 text-sm transition-colors"
          >
            Clear Logs
          </button>
        </div>
        
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm">
          {logs.length === 0 ? (
            <p className="text-gray-500">No events logged yet...</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Current Queue Display */}
      {queueData.teams.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Current Queue</h2>
          <div className="space-y-2">
            {queueData.teams.map((team, index) => (
              <div key={team.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                <div>
                  <span className="font-medium text-gray-800">#{index + 1} {team.name}</span>
                  <span className="text-sm text-gray-600 ml-2">({team.members} members)</span>
                </div>
                <div className="text-sm text-gray-500">
                  Status: {team.status} | Wins: {team.wins}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};