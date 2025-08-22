import React from 'react'
import { Match } from '../types'

interface ScoreboardProps {
  match: Match
  className?: string
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ match, className = '' }) => {
  const getStatusDisplay = () => {
    switch (match.status) {
      case 'active':
        return {
          text: 'LIVE',
          className: 'bg-red-500 text-white animate-pulse'
        }
      case 'confirming':
        return {
          text: 'CONFIRMING',
          className: 'bg-yellow-500 text-white'
        }
      case 'completed':
        return {
          text: 'COMPLETED',
          className: 'bg-green-500 text-white'
        }
      default:
        return {
          text: 'UNKNOWN',
          className: 'bg-gray-500 text-white'
        }
    }
  }

  const getWinnerIndicator = (teamScore: number, opponentScore: number) => {
    if (match.status !== 'completed') return ''
    return teamScore > opponentScore ? 'ring-4 ring-yellow-400' : ''
  }

  const status = getStatusDisplay()

  return (
    <div className={`bg-white rounded-lg shadow-lg p-3 sm:p-6 ${className}`}>
      {/* Status Badge */}
      <div className="flex justify-center mb-4 sm:mb-6">
        <span className={`px-3 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-bold ${status.className}`}>
          {status.text}
        </span>
      </div>

      {/* Main Scoreboard */}
      <div className="grid grid-cols-3 items-center gap-2 sm:gap-6">
        {/* Team 1 */}
        <div className={`text-center ${getWinnerIndicator(match.score1, match.score2)} rounded-lg p-2 sm:p-4`}>
          <h3 className="text-sm sm:text-xl font-bold text-gray-800 mb-1 sm:mb-2 truncate" title={match.team1.name}>
            {match.team1.name}
          </h3>
          <div className="text-3xl sm:text-5xl font-bold text-blue-600 mb-1 sm:mb-2">
            {match.score1}
          </div>
          <div className="text-xs sm:text-sm text-gray-500">
            {match.team1.members} players
          </div>
        </div>

        {/* VS Section */}
        <div className="text-center">
          <div className="text-lg sm:text-2xl font-bold text-gray-400 mb-1 sm:mb-2">VS</div>
          <div className="text-xs sm:text-sm text-gray-500">
            Target: {match.targetScore}
          </div>
          <div className="text-xs text-gray-400 mt-1 capitalize">
            {match.matchType.replace('-', ' ')}
          </div>
        </div>

        {/* Team 2 */}
        <div className={`text-center ${getWinnerIndicator(match.score2, match.score1)} rounded-lg p-2 sm:p-4`}>
          <h3 className="text-sm sm:text-xl font-bold text-gray-800 mb-1 sm:mb-2 truncate" title={match.team2.name}>
            {match.team2.name}
          </h3>
          <div className="text-3xl sm:text-5xl font-bold text-red-600 mb-1 sm:mb-2">
            {match.score2}
          </div>
          <div className="text-xs sm:text-sm text-gray-500">
            {match.team2.members} players
          </div>
        </div>
      </div>

      {/* Progress Bar for Target Score */}
      <div className="mt-4 sm:mt-6">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress to Target ({match.targetScore})</span>
          <span>{Math.max(match.score1, match.score2)}/{match.targetScore}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-red-500 h-2 rounded-full transition-all duration-500"
            style={{ 
              width: `${Math.min(100, (Math.max(match.score1, match.score2) / match.targetScore) * 100)}%` 
            }}
          />
        </div>
      </div>

      {/* Confirmation Status for Confirming Matches */}
      {match.status === 'confirming' && (
        <div className="mt-3 sm:mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="text-xs sm:text-sm font-medium text-yellow-800 mb-2">
            Waiting for Result Confirmation
          </div>
          <div className="flex justify-between text-xs">
            <div className={`flex items-center ${match.confirmed.team1 ? 'text-green-600' : 'text-gray-500'} truncate`}>
              <span className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${match.confirmed.team1 ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="truncate">{match.team1.name}</span>
            </div>
            <div className={`flex items-center ${match.confirmed.team2 ? 'text-green-600' : 'text-gray-500'} truncate`}>
              <span className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${match.confirmed.team2 ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="truncate">{match.team2.name}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}