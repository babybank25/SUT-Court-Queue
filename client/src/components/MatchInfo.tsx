import React from 'react'
import { Match } from '../types'

interface MatchInfoProps {
  match: Match
  className?: string
}

export const MatchInfo: React.FC<MatchInfoProps> = ({ match, className = '' }) => {
  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Bangkok'
    })
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Bangkok'
    })
  }

  const getMatchDuration = () => {
    const startTime = new Date(match.startTime)
    const endTime = match.endTime ? new Date(match.endTime) : new Date()
    const durationMs = endTime.getTime() - startTime.getTime()
    
    const minutes = Math.floor(durationMs / (1000 * 60))
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getStatusColor = () => {
    switch (match.status) {
      case 'active':
        return 'text-green-600 bg-green-50'
      case 'confirming':
        return 'text-yellow-600 bg-yellow-50'
      case 'completed':
        return 'text-blue-600 bg-blue-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getWinner = () => {
    if (match.status !== 'completed') return null
    
    if (match.score1 > match.score2) {
      return { team: match.team1, score: match.score1 }
    } else if (match.score2 > match.score1) {
      return { team: match.team2, score: match.score2 }
    }
    return null // Tie
  }

  const winner = getWinner()

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Match Details</h3>
        <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getStatusColor()}`}>
          {match.status}
        </span>
      </div>

      <div className="space-y-4">
        {/* Basic Match Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Match Type</label>
              <p className="text-sm text-gray-900 capitalize">
                {match.matchType.replace('-', ' ')}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-500">Target Score</label>
              <p className="text-sm text-gray-900">{match.targetScore} points</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Current Score</label>
              <p className="text-sm text-gray-900 font-mono">
                {match.score1} - {match.score2}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Start Time</label>
              <p className="text-sm text-gray-900">
                {formatTime(match.startTime)}
              </p>
              <p className="text-xs text-gray-500">
                {formatDate(match.startTime)}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Duration</label>
              <p className="text-sm text-gray-900 font-mono">
                {getMatchDuration()}
              </p>
            </div>

            {match.endTime && (
              <div>
                <label className="text-sm font-medium text-gray-500">End Time</label>
                <p className="text-sm text-gray-900">
                  {formatTime(match.endTime)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Winner Information */}
        {winner && (
          <div className="border-t pt-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="text-2xl mr-3">🏆</div>
                <div>
                  <p className="text-sm font-medium text-yellow-800">Winner</p>
                  <p className="text-lg font-bold text-yellow-900">
                    {winner.team.name}
                  </p>
                  <p className="text-sm text-yellow-700">
                    Final Score: {winner.score} points
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Team Information */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-500 mb-3">Teams</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="font-medium text-blue-900">{match.team1.name}</p>
              <p className="text-sm text-blue-700">{match.team1.members} players</p>
              <p className="text-sm text-blue-600">{match.team1.wins} wins</p>
              {match.team1.contactInfo && (
                <p className="text-xs text-blue-500 truncate" title={match.team1.contactInfo}>
                  {match.team1.contactInfo}
                </p>
              )}
            </div>
            
            <div className="bg-red-50 rounded-lg p-3">
              <p className="font-medium text-red-900">{match.team2.name}</p>
              <p className="text-sm text-red-700">{match.team2.members} players</p>
              <p className="text-sm text-red-600">{match.team2.wins} wins</p>
              {match.team2.contactInfo && (
                <p className="text-xs text-red-500 truncate" title={match.team2.contactInfo}>
                  {match.team2.contactInfo}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Confirmation Status */}
        {match.status === 'confirming' && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-500 mb-3">Confirmation Status</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm">{match.team1.name}</span>
                <span className={`text-sm font-medium ${match.confirmed.team1 ? 'text-green-600' : 'text-gray-500'}`}>
                  {match.confirmed.team1 ? '✓ Confirmed' : 'Waiting...'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm">{match.team2.name}</span>
                <span className={`text-sm font-medium ${match.confirmed.team2 ? 'text-green-600' : 'text-gray-500'}`}>
                  {match.confirmed.team2 ? '✓ Confirmed' : 'Waiting...'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}