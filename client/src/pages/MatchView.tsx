import React, { useState } from 'react'
import { Scoreboard, MatchInfo, MatchStatusIndicator, ConfirmationModal, RecentEvents } from '../components'
import { useRealtimeMatch } from '../hooks/useRealtimeMatch'
import { useToast } from '../contexts/ToastContext'

export const MatchView: React.FC = () => {
  const { showToast } = useToast()
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  
  const {
    currentMatch,
    isLoading,
    error,
    isConnected,
    lastUpdate,
    hasActiveMatch,
    refetch
  } = useRealtimeMatch({
    onMatchUpdate: (data) => {
      // Show toast notifications for important match events
      switch (data.event) {
        case 'match_started':
          showToast('success', 'Match Started', `${data.teams} are now playing!`)
          break
        case 'score_updated':
          showToast('info', 'Score Updated', data.score || 'Score has been updated')
          break
        case 'match_ended':
          showToast('warning', 'Match Ended', 'Waiting for result confirmation')
          break
        case 'match_completed':
          showToast('success', 'Match Completed', `Winner: ${data.winner}`)
          break
        case 'match_timeout_resolved':
          showToast('info', 'Match Resolved', 'Match resolved due to timeout')
          break
      }
    }
  })

  // Handle loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Match View</h2>
          <p className="text-gray-600">Live match scores and details</p>
        </div>
        
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading match data...</span>
        </div>
      </div>
    )
  }

  // Handle error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Match View</h2>
          <p className="text-gray-600">Live match scores and details</p>
        </div>
        
        <div className="text-center py-12">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-red-600 mb-2">Error Loading Match</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1 sm:mb-2">Match View</h2>
        <p className="text-sm sm:text-base text-gray-600">Live match scores and details</p>
        
        {/* Connection Status */}
        {!isConnected && (
          <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm bg-red-100 text-red-800">
            <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
            <span className="hidden sm:inline">Disconnected - Updates may be delayed</span>
            <span className="sm:hidden">Offline</span>
          </div>
        )}
      </div>

      {hasActiveMatch && currentMatch ? (
        <div className="space-y-4 sm:space-y-6">
          {/* Match Status Indicator */}
          <MatchStatusIndicator match={currentMatch} />

          {/* Main Scoreboard */}
          <Scoreboard match={currentMatch} />

          {/* Match Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <MatchInfo match={currentMatch} />
            
            {/* Recent Events Panel */}
            <RecentEvents matchId={currentMatch.id} />
          </div>

          {/* Match Confirmation Section */}
          {currentMatch.status === 'confirming' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-6">
              <div className="text-center mb-3 sm:mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-yellow-800 mb-1 sm:mb-2">
                  🏀 Match Confirmation Required
                </h3>
                <p className="text-sm sm:text-base text-yellow-700">
                  The match has ended. Teams need to confirm the final result.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {/* Team 1 Confirmation */}
                <div className="bg-white rounded-lg p-3 sm:p-4 border border-yellow-200">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <h4 className="font-semibold text-gray-800 truncate text-sm sm:text-base" title={currentMatch.team1.name}>
                      {currentMatch.team1.name}
                    </h4>
                    <span className={`text-xs sm:text-sm font-medium ${
                      currentMatch.confirmed.team1 ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {currentMatch.confirmed.team1 ? '✓ Confirmed' : 'Waiting...'}
                    </span>
                  </div>
                  {!currentMatch.confirmed.team1 && (
                    <button
                      onClick={() => {
                        setSelectedTeamId(currentMatch.team1.id)
                        setIsConfirmationModalOpen(true)
                      }}
                      className="w-full px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors text-sm sm:text-base min-h-[44px] touch-manipulation"
                    >
                      <span className="hidden sm:inline">Confirm as {currentMatch.team1.name}</span>
                      <span className="sm:hidden">Confirm</span>
                    </button>
                  )}
                </div>

                {/* Team 2 Confirmation */}
                <div className="bg-white rounded-lg p-3 sm:p-4 border border-yellow-200">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <h4 className="font-semibold text-gray-800 truncate text-sm sm:text-base" title={currentMatch.team2.name}>
                      {currentMatch.team2.name}
                    </h4>
                    <span className={`text-xs sm:text-sm font-medium ${
                      currentMatch.confirmed.team2 ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {currentMatch.confirmed.team2 ? '✓ Confirmed' : 'Waiting...'}
                    </span>
                  </div>
                  {!currentMatch.confirmed.team2 && (
                    <button
                      onClick={() => {
                        setSelectedTeamId(currentMatch.team2.id)
                        setIsConfirmationModalOpen(true)
                      }}
                      className="w-full px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors text-sm sm:text-base min-h-[44px] touch-manipulation"
                    >
                      <span className="hidden sm:inline">Confirm as {currentMatch.team2.name}</span>
                      <span className="sm:hidden">Confirm</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Both Confirmed Message */}
              {currentMatch.confirmed.team1 && currentMatch.confirmed.team2 && (
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-lg">
                    <span className="mr-2">✅</span>
                    Both teams have confirmed the result. Match will be completed shortly.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏀</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No Active Match</h3>
          <p className="text-gray-600 mb-4">There is currently no match in progress</p>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              Matches will appear here automatically when they start
            </p>
            <button
              onClick={refetch}
              className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              Check for matches
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {currentMatch && selectedTeamId && (
        <ConfirmationModal
          isOpen={isConfirmationModalOpen}
          onClose={() => {
            setIsConfirmationModalOpen(false)
            setSelectedTeamId(null)
          }}
          match={currentMatch}
          currentTeam={
            selectedTeamId === currentMatch.team1.id 
              ? currentMatch.team1 
              : currentMatch.team2
          }
          onConfirmationSuccess={(confirmed) => {
            showToast(
              confirmed ? 'success' : 'info',
              confirmed ? 'Result Confirmed' : 'Result Disputed',
              confirmed 
                ? 'Match result has been confirmed'
                : 'Result disputed. Admin will resolve this match.'
            )
            // Refresh match data to get updated confirmation status
            refetch()
          }}
        />
      )}
    </div>
  )
}