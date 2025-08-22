import React, { useState, useEffect } from 'react';
import { useRealtimeCourtStatus } from '../hooks/useRealtimeCourtStatus';

interface CourtStatusProps {
  className?: string;
}

export const CourtStatus: React.FC<CourtStatusProps> = ({ className = '' }) => {
  const {
    courtStatus,
    isLoading,
    error,
    isConnected,
    isCourtOpen,
    isInCooldown,
    isChampionReturnMode,
    isRegularMode,
    hasActiveMatches,
    activeMatchCount,
    getFormattedTime,
    getFormattedCooldownTime,
    cooldownTimeRemaining
  } = useRealtimeCourtStatus();

  const [currentTime, setCurrentTime] = useState<string>('');

  // Update current time every second
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(getFormattedTime());
    };

    updateTime(); // Initial update
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [getFormattedTime]);

  const getCourtStatusIcon = () => {
    if (!isCourtOpen) return '🔒';
    if (isInCooldown()) return '⏳';
    if (hasActiveMatches) return '🏀';
    return '✅';
  };

  const getCourtStatusText = () => {
    if (!isCourtOpen) return 'Court Closed';
    if (isInCooldown()) return 'Champion Return Mode';
    if (hasActiveMatches) return 'Match in Progress';
    return 'Court Available';
  };

  const getCourtStatusColor = () => {
    if (!isCourtOpen) return 'text-red-600 bg-red-50 border-red-200';
    if (isInCooldown()) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (hasActiveMatches) return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getModeIcon = () => {
    return isChampionReturnMode ? '👑' : '🏀';
  };

  const getModeText = () => {
    return isChampionReturnMode ? 'Champion Return' : 'Regular Mode';
  };

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-center space-x-2 text-red-800 mb-2">
          <span className="text-xl">⚠️</span>
          <h3 className="font-semibold">Error Loading Court Status</h3>
        </div>
        <p className="text-red-700 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className={`bg-gray-50 rounded-lg p-3 sm:p-6 ${className}`}>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Court Status</h3>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-xs sm:text-sm text-gray-500">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-500 mt-2">Loading court status...</p>
        </div>
      )}

      {!isLoading && (
        <div className="space-y-3 sm:space-y-4">
          {/* Main Court Status */}
          <div className={`p-3 sm:p-4 rounded-lg border-2 ${getCourtStatusColor()}`}>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl mb-2">{getCourtStatusIcon()}</div>
              <h4 className="text-base sm:text-lg font-bold mb-1">{getCourtStatusText()}</h4>
              {hasActiveMatches && (
                <p className="text-xs sm:text-sm opacity-75">
                  {activeMatchCount} active match{activeMatchCount !== 1 ? 'es' : ''}
                </p>
              )}
            </div>
          </div>

          {/* Current Time */}
          <div className="bg-white rounded-lg p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-mono font-bold text-gray-800 mb-1">
              {currentTime}
            </div>
            <div className="text-xs sm:text-sm text-gray-500">
              {courtStatus.timezone}
            </div>
          </div>

          {/* Game Mode */}
          <div className="bg-white rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 min-w-0 flex-1">
                <span className="text-lg sm:text-xl">{getModeIcon()}</span>
                <span className="font-medium text-gray-800 text-sm sm:text-base truncate">{getModeText()}</span>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                isChampionReturnMode 
                  ? 'bg-yellow-100 text-yellow-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {isChampionReturnMode ? 'Champion' : 'Regular'}
              </div>
            </div>
          </div>

          {/* Cooldown Timer */}
          {isInCooldown() && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
              <div className="text-center">
                <div className="text-lg sm:text-xl mb-2">⏳</div>
                <h4 className="font-semibold text-yellow-800 mb-1 text-sm sm:text-base">Cooldown Active</h4>
                <div className="text-xl sm:text-2xl font-mono font-bold text-yellow-600 mb-1">
                  {getFormattedCooldownTime()}
                </div>
                <p className="text-xs sm:text-sm text-yellow-700">
                  Champion team cooldown remaining
                </p>
              </div>
            </div>
          )}

          {/* Court Information */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="bg-white rounded-lg p-2 sm:p-3 text-center">
              <div className="text-base sm:text-lg font-bold text-gray-800">
                {isCourtOpen ? 'Open' : 'Closed'}
              </div>
              <div className="text-xs text-gray-500">Court Status</div>
            </div>
            <div className="bg-white rounded-lg p-2 sm:p-3 text-center">
              <div className="text-base sm:text-lg font-bold text-gray-800">
                {activeMatchCount}
              </div>
              <div className="text-xs text-gray-500">Active Matches</div>
            </div>
          </div>

          {/* Additional Information */}
          {isChampionReturnMode && !isInCooldown() && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center space-x-2 text-blue-800">
                <span className="text-sm">ℹ️</span>
                <span className="text-sm">
                  Champion return mode: Winners stay on court
                </span>
              </div>
            </div>
          )}

          {!isCourtOpen && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center space-x-2 text-red-800">
                <span className="text-sm">🔒</span>
                <span className="text-sm">
                  Court is currently closed for maintenance
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Last Updated */}
      <div className="mt-4 text-xs text-gray-400 text-center">
        Last updated: {new Date(courtStatus.currentTime).toLocaleTimeString('th-TH')}
      </div>
    </div>
  );
};