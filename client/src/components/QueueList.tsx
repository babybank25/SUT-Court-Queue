import React from 'react';
import { useRealtimeQueue } from '../hooks/useRealtimeQueue';
import { Team } from '../types';

interface QueueListProps {
  className?: string;
}

export const QueueList: React.FC<QueueListProps> = ({ className = '' }) => {
  const { 
    queueData, 
    isLoading, 
    error, 
    isConnected,
    hasTeams,
    isQueueFull,
    getWaitingTeams,
    getPlayingTeams,
    getCooldownTeams
  } = useRealtimeQueue();

  const waitingTeams = getWaitingTeams();
  const playingTeams = getPlayingTeams();
  const cooldownTeams = getCooldownTeams();

  const getStatusBadge = (status: Team['status']) => {
    switch (status) {
      case 'playing':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            🏀 Playing
          </span>
        );
      case 'cooldown':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            ⏳ Cooldown
          </span>
        );
      case 'waiting':
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            ⏰ Waiting
          </span>
        );
    }
  };

  const renderTeamItem = (team: Team, index: number, showPosition: boolean = true) => (
    <div 
      key={team.id} 
      className="flex items-center justify-between bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
        {showPosition && (
          <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold">
            {team.position || index + 1}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-gray-900 text-sm sm:text-base truncate" title={team.name}>
            {team.name}
          </h4>
          <p className="text-xs sm:text-sm text-gray-500">
            {team.members} player{team.members !== 1 ? 's' : ''}
            {team.wins > 0 && (
              <span className="ml-1 sm:ml-2 text-green-600 font-medium">
                • {team.wins} win{team.wins !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2 flex-shrink-0">
        {getStatusBadge(team.status)}
      </div>
    </div>
  );

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-center space-x-2 text-red-800 mb-2">
          <span className="text-xl">⚠️</span>
          <h3 className="font-semibold">Error Loading Queue</h3>
        </div>
        <p className="text-red-700 text-sm">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
        >
          Refresh page
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-gray-50 rounded-lg p-3 sm:p-6 ${className}`}>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Current Queue</h3>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-xs sm:text-sm text-gray-500">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Queue Statistics */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="text-center p-2 sm:p-3 bg-white rounded-lg">
          <div className="text-lg sm:text-2xl font-bold text-blue-600">{queueData.totalTeams || 0}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
        <div className="text-center p-2 sm:p-3 bg-white rounded-lg">
          <div className="text-lg sm:text-2xl font-bold text-green-600">{queueData.availableSlots || 0}</div>
          <div className="text-xs text-gray-500">Available</div>
        </div>
        <div className="text-center p-2 sm:p-3 bg-white rounded-lg">
          <div className="text-lg sm:text-2xl font-bold text-yellow-600">{waitingTeams.length}</div>
          <div className="text-xs text-gray-500">Waiting</div>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-500 mt-2">Loading queue...</p>
        </div>
      )}

      {!isLoading && !hasTeams && (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">🏀</div>
          <p className="text-gray-500 font-medium">No teams in queue</p>
          <p className="text-gray-400 text-sm mt-1">Be the first to join!</p>
        </div>
      )}

      {!isLoading && hasTeams && (
        <div className="space-y-3 sm:space-y-4">
          {/* Currently Playing */}
          {playingTeams.length > 0 && (
            <div>
              <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Currently Playing
              </h4>
              <div className="space-y-2">
                {playingTeams.map((team, index) => renderTeamItem(team, index, false))}
              </div>
            </div>
          )}

          {/* Waiting in Queue */}
          {waitingTeams.length > 0 && (
            <div>
              <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2 flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                Waiting in Queue
              </h4>
              <div className="space-y-2">
                {waitingTeams.map((team, index) => renderTeamItem(team, index, true))}
              </div>
            </div>
          )}

          {/* In Cooldown */}
          {cooldownTeams.length > 0 && (
            <div>
              <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2 flex items-center">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                In Cooldown
              </h4>
              <div className="space-y-2">
                {cooldownTeams.map((team, index) => renderTeamItem(team, index, false))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Queue Full Warning */}
      {isQueueFull && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center space-x-2 text-yellow-800">
            <span className="text-sm">⚠️</span>
            <span className="text-sm font-medium">Queue is currently full</span>
          </div>
        </div>
      )}

      {/* Last Updated */}
      {queueData.lastUpdated && (
        <div className="mt-4 text-xs text-gray-400 text-center">
          Last updated: {new Date(queueData.lastUpdated).toLocaleTimeString('th-TH')}
        </div>
      )}
    </div>
  );
};