import React, { useEffect, useState } from 'react';
import { useAuthApi } from '../../hooks/useAuthApi';
import { useToast } from '../../contexts/ToastContext';
import { Match } from '../../types';

interface ActiveMatchesProps {
  onRefresh?: () => void;
}

export const ActiveMatches: React.FC<ActiveMatchesProps> = ({ onRefresh }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { get, post } = useAuthApi();
  const { showToast } = useToast();

  const fetchMatches = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await get<{ matches: { active: Match[] } }>('/api/admin/dashboard');
      if (response.success && response.data) {
        setMatches(response.data.matches.active || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch matches');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceResolve = async (matchId: string) => {
    try {
      setActionLoading(matchId);
      const response = await post(`/api/admin/match/${matchId}/force-resolve`);
      
      if (response.success) {
        showToast('success', 'Match Resolved', 'Match has been force resolved successfully');
        await fetchMatches();
        onRefresh?.();
      }
    } catch (err) {
      showToast('error', 'Action Failed', err instanceof Error ? err.message : 'Failed to resolve match');
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchMatches();
    
    // Refresh matches every 10 seconds
    const interval = setInterval(fetchMatches, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'confirming':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getMatchTypeColor = (type: string) => {
    return type === 'champion-return' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800';
  };

  const formatDuration = (startTime: Date) => {
    const now = new Date();
    const start = new Date(startTime);
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    return `${diffMins}:${diffSecs.toString().padStart(2, '0')}`;
  };

  if (isLoading && matches.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Active Matches</h3>
        <div className="animate-pulse space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="h-8 bg-gray-200 rounded w-24 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Active Matches</h3>
        <div className="text-center py-4">
          <div className="text-red-500 mb-2">⚠️</div>
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button
            onClick={fetchMatches}
            className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold">Active Matches</h3>
          <p className="text-sm text-gray-500">Monitor and manage ongoing matches</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">
              {matches.length} Active
            </div>
            <div className="text-xs text-gray-500">
              Matches Running
            </div>
          </div>
          <button
            onClick={fetchMatches}
            disabled={isLoading}
            className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-md transition-colors"
            title="Refresh matches"
          >
            <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">🏀</div>
          <p className="text-gray-500">No active matches</p>
          <p className="text-sm text-gray-400 mt-1">Matches will appear here when started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <div key={match.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 mb-1">
                    {match.team1.name} vs {match.team2.name}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(match.status)}`}>
                      {match.status}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMatchTypeColor(match.matchType)}`}>
                      {match.matchType.replace('-', ' ')}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {match.score1} - {match.score2}
                  </div>
                  <div className="text-xs text-gray-500">
                    Target: {match.targetScore}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm text-gray-600">
                <div>
                  Duration: {formatDuration(match.startTime)}
                </div>
                
                {match.status === 'confirming' && (
                  <div className="flex items-center space-x-2">
                    <div className="text-yellow-600">
                      Waiting for confirmation
                    </div>
                    <button
                      onClick={() => handleForceResolve(match.id)}
                      disabled={actionLoading === match.id}
                      className="bg-orange-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === match.id ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Resolving...
                        </div>
                      ) : (
                        'Force Resolve'
                      )}
                    </button>
                  </div>
                )}
              </div>

              {match.status === 'confirming' && (
                <div className="mt-2 p-2 bg-yellow-50 rounded text-sm">
                  <div className="font-medium text-yellow-800 mb-1">Confirmation Status:</div>
                  <div className="flex space-x-4 text-yellow-700">
                    <div className="flex items-center">
                      <span className={`w-2 h-2 rounded-full mr-2 ${match.confirmed.team1 ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                      {match.team1.name}: {match.confirmed.team1 ? 'Confirmed' : 'Pending'}
                    </div>
                    <div className="flex items-center">
                      <span className={`w-2 h-2 rounded-full mr-2 ${match.confirmed.team2 ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                      {match.team2.name}: {match.confirmed.team2 ? 'Confirmed' : 'Pending'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};