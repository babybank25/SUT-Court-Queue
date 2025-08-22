import React from 'react'
import { Match } from '../types'

interface MatchStatusIndicatorProps {
  match: Match
  className?: string
}

export const MatchStatusIndicator: React.FC<MatchStatusIndicatorProps> = ({ 
  match, 
  className = '' 
}) => {
  const getStatusConfig = () => {
    switch (match.status) {
      case 'active':
        return {
          icon: '🔴',
          text: 'LIVE MATCH',
          description: 'Match is currently in progress',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          badgeColor: 'bg-red-500 text-white animate-pulse'
        }
      case 'confirming':
        return {
          icon: '⏳',
          text: 'AWAITING CONFIRMATION',
          description: 'Teams are confirming the match result',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800',
          badgeColor: 'bg-yellow-500 text-white'
        }
      case 'completed':
        return {
          icon: '✅',
          text: 'MATCH COMPLETED',
          description: 'Match has been completed and confirmed',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800',
          badgeColor: 'bg-green-500 text-white'
        }
      default:
        return {
          icon: '❓',
          text: 'UNKNOWN STATUS',
          description: 'Match status is unknown',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-800',
          badgeColor: 'bg-gray-500 text-white'
        }
    }
  }

  const getConfirmationDetails = () => {
    if (match.status !== 'confirming') return null

    const team1Status = match.confirmed.team1 ? 'Confirmed' : 'Waiting'
    const team2Status = match.confirmed.team2 ? 'Confirmed' : 'Waiting'
    
    return {
      team1Status,
      team2Status,
      bothConfirmed: match.confirmed.team1 && match.confirmed.team2
    }
  }

  const getWinnerInfo = () => {
    if (match.status !== 'completed') return null
    
    if (match.score1 > match.score2) {
      return {
        winner: match.team1.name,
        score: `${match.score1}-${match.score2}`
      }
    } else if (match.score2 > match.score1) {
      return {
        winner: match.team2.name,
        score: `${match.score2}-${match.score1}`
      }
    }
    
    return {
      winner: 'Tie Game',
      score: `${match.score1}-${match.score2}`
    }
  }

  const config = getStatusConfig()
  const confirmationDetails = getConfirmationDetails()
  const winnerInfo = getWinnerInfo()

  return (
    <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${config.badgeColor}`}>
              {config.text}
            </span>
          </div>
        </div>
        
        {match.status === 'active' && (
          <div className="text-right">
            <div className="text-sm font-medium text-gray-600">Live Score</div>
            <div className="text-lg font-bold text-gray-900">
              {match.score1} - {match.score2}
            </div>
          </div>
        )}
      </div>

      <p className={`text-sm ${config.textColor} mb-3`}>
        {config.description}
      </p>

      {/* Active Match Details */}
      {match.status === 'active' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Target Score:</span>
            <span className="font-medium">{match.targetScore}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Match Type:</span>
            <span className="font-medium capitalize">{match.matchType.replace('-', ' ')}</span>
          </div>
        </div>
      )}

      {/* Confirmation Details */}
      {confirmationDetails && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">Confirmation Status:</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className={`p-2 rounded ${match.confirmed.team1 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              <div className="font-medium">{match.team1.name}</div>
              <div className="text-xs">{confirmationDetails.team1Status}</div>
            </div>
            <div className={`p-2 rounded ${match.confirmed.team2 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              <div className="font-medium">{match.team2.name}</div>
              <div className="text-xs">{confirmationDetails.team2Status}</div>
            </div>
          </div>
          
          {confirmationDetails.bothConfirmed && (
            <div className="text-center text-sm text-green-600 font-medium">
              ✓ Both teams have confirmed the result
            </div>
          )}
        </div>
      )}

      {/* Winner Information */}
      {winnerInfo && (
        <div className="mt-3 p-3 bg-white rounded border">
          <div className="flex items-center justify-center space-x-2">
            <span className="text-xl">🏆</span>
            <div className="text-center">
              <div className="font-bold text-gray-900">{winnerInfo.winner}</div>
              <div className="text-sm text-gray-600">Final Score: {winnerInfo.score}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}