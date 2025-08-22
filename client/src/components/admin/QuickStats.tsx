import React, { useEffect, useState } from 'react';
import { useAuthApi } from '../../hooks/useAuthApi';

interface DashboardStats {
  queue: {
    teams: any[];
    totalTeams: number;
    maxSize: number;
    availableSlots: number;
  };
  matches: {
    active: any[];
    totalActive: number;
  };
  court: {
    status: string;
    mode: string;
    cooldownEnd?: string;
  };
  teams: {
    total: number;
    waiting: number;
    playing: number;
    cooldown: number;
  };
  lastUpdated: string;
}

export const QuickStats: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { get } = useAuthApi();

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await get<DashboardStats>('/api/admin/dashboard');
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading && !stats) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
        <div className="animate-pulse space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-8"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
        <div className="text-center py-4">
          <div className="text-red-500 mb-2">⚠️</div>
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button
            onClick={fetchStats}
            className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
        <p className="text-gray-500 text-center py-4">No data available</p>
      </div>
    );
  }

  const getCourtStatusColor = (status: string) => {
    return status === 'open' ? 'text-green-600' : 'text-red-600';
  };

  const getModeColor = (mode: string) => {
    return mode === 'champion-return' ? 'text-orange-600' : 'text-blue-600';
  };

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-6">
      <div className="flex justify-between items-center mb-3 sm:mb-4">
        <h3 className="text-base sm:text-lg font-semibold">Quick Stats</h3>
        <button
          onClick={fetchStats}
          disabled={isLoading}
          className="text-sm text-gray-500 hover:text-gray-700 active:text-gray-800 disabled:opacity-50 p-1 touch-manipulation"
          title="Refresh stats"
        >
          <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      
      <div className="space-y-2 sm:space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 text-sm sm:text-base">Teams in Queue:</span>
          <div className="flex items-center space-x-2">
            <span className="font-medium text-sm sm:text-base">{stats.queue.totalTeams}</span>
            <span className="text-xs text-gray-500">/ {stats.queue.maxSize}</span>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600 text-sm sm:text-base">Available Slots:</span>
          <span className={`font-medium text-sm sm:text-base ${stats.queue.availableSlots > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.queue.availableSlots}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600 text-sm sm:text-base">Active Matches:</span>
          <span className="font-medium text-sm sm:text-base">{stats.matches.totalActive}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600 text-sm sm:text-base">Court Status:</span>
          <span className={`font-medium capitalize text-sm sm:text-base ${getCourtStatusColor(stats.court.status)}`}>
            {stats.court.status}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600 text-sm sm:text-base">Court Mode:</span>
          <span className={`font-medium capitalize text-sm sm:text-base ${getModeColor(stats.court.mode)}`}>
            <span className="hidden sm:inline">{stats.court.mode.replace('-', ' ')}</span>
            <span className="sm:hidden">{stats.court.mode === 'champion-return' ? 'Champion' : 'Regular'}</span>
          </span>
        </div>
        
        <hr className="my-3" />
        
        <div className="text-xs sm:text-sm text-gray-600">
          <div className="font-medium mb-2">Team Status:</div>
          <div className="grid grid-cols-2 gap-1 sm:gap-2">
            <div className="flex justify-between">
              <span>Total:</span>
              <span className="font-medium">{stats.teams.total}</span>
            </div>
            <div className="flex justify-between">
              <span>Waiting:</span>
              <span className="font-medium text-blue-600">{stats.teams.waiting}</span>
            </div>
            <div className="flex justify-between">
              <span>Playing:</span>
              <span className="font-medium text-green-600">{stats.teams.playing}</span>
            </div>
            <div className="flex justify-between">
              <span>Cooldown:</span>
              <span className="font-medium text-orange-600">{stats.teams.cooldown}</span>
            </div>
          </div>
        </div>
        
        {stats.court.cooldownEnd && (
          <div className="mt-2 sm:mt-3 p-2 bg-orange-50 rounded text-xs sm:text-sm">
            <div className="text-orange-700 font-medium">Champion Cooldown</div>
            <div className="text-orange-600">
              Until: {new Date(stats.court.cooldownEnd).toLocaleTimeString()}
            </div>
          </div>
        )}
        
        <hr className="my-2 sm:my-3" />
        
        <div className="text-xs sm:text-sm text-gray-600">
          <div className="font-medium mb-2">System Health:</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Queue Utilization:</span>
              <span className={`font-medium ${
                (stats.queue.totalTeams / stats.queue.maxSize) > 0.8 ? 'text-red-600' : 
                (stats.queue.totalTeams / stats.queue.maxSize) > 0.6 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {Math.round((stats.queue.totalTeams / stats.queue.maxSize) * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>Court Activity:</span>
              <span className={`font-medium ${stats.matches.totalActive > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                {stats.matches.totalActive > 0 ? 'Active' : 'Idle'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t text-xs text-gray-500">
        Last updated: {new Date(stats.lastUpdated).toLocaleTimeString()}
      </div>
    </div>
  );
};