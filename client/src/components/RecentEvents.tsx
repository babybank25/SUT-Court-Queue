import React, { useState, useEffect } from 'react'
import { MatchEvent } from '../types'

interface RecentEventsProps {
  matchId: string
  className?: string
}

export const RecentEvents: React.FC<RecentEventsProps> = ({ matchId, className = '' }) => {
  const [events, setEvents] = useState<MatchEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchEvents()
  }, [matchId])

  const fetchEvents = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch(`/api/match/${matchId}/events`)
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch events')
      }
      
      // Convert date strings to Date objects
      const eventsWithDates = data.data.events.map((event: any) => ({
        ...event,
        createdAt: new Date(event.createdAt)
      }))
      
      setEvents(eventsWithDates)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events')
    } finally {
      setIsLoading(false)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Bangkok'
    })
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'score_update':
        return '🏀'
      case 'status_change':
        return '🔄'
      case 'confirmation':
        return '✅'
      case 'timeout':
        return '⏰'
      default:
        return '📝'
    }
  }

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'score_update':
        return 'border-blue-200 bg-blue-50'
      case 'status_change':
        return 'border-yellow-200 bg-yellow-50'
      case 'confirmation':
        return 'border-green-200 bg-green-50'
      case 'timeout':
        return 'border-red-200 bg-red-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  const renderEventDescription = (event: MatchEvent) => {
    const { eventType, eventData } = event

    switch (eventType) {
      case 'score_update':
        return (
          <div>
            <p className="text-sm font-medium text-gray-800">
              Score Update: {eventData.score1} - {eventData.score2}
            </p>
            {eventData.previousScore1 !== undefined && eventData.previousScore2 !== undefined && (
              <p className="text-xs text-gray-600">
                Previous: {eventData.previousScore1} - {eventData.previousScore2}
              </p>
            )}
            {eventData.team1Name && eventData.team2Name && (
              <p className="text-xs text-gray-500">
                {eventData.team1Name} vs {eventData.team2Name}
              </p>
            )}
          </div>
        )

      case 'status_change':
        return (
          <div>
            <p className="text-sm font-medium text-gray-800 capitalize">
              Status: {eventData.status?.replace('_', ' ')}
            </p>
            {eventData.previousStatus && (
              <p className="text-xs text-gray-600 capitalize">
                From: {eventData.previousStatus.replace('_', ' ')}
              </p>
            )}
            {eventData.reason && (
              <p className="text-xs text-gray-500 capitalize">
                Reason: {eventData.reason.replace('_', ' ')}
              </p>
            )}
            {eventData.winner && (
              <p className="text-xs text-green-600 font-medium">
                Winner: {eventData.winner}
              </p>
            )}
            {eventData.finalScore && (
              <p className="text-xs text-gray-600">
                Final Score: {eventData.finalScore}
              </p>
            )}
            {eventData.duration && (
              <p className="text-xs text-gray-500">
                Duration: {formatDuration(eventData.duration)}
              </p>
            )}
          </div>
        )

      case 'confirmation':
        return (
          <div>
            <p className="text-sm font-medium text-gray-800">
              {eventData.teamName} {eventData.confirmed ? 'confirmed' : 'disputed'} the result
            </p>
            {eventData.bothConfirmed && (
              <p className="text-xs text-green-600 font-medium">
                Both teams confirmed - Match completed
              </p>
            )}
          </div>
        )

      case 'timeout':
        return (
          <div>
            <p className="text-sm font-medium text-gray-800">
              Match resolved by timeout
            </p>
            {eventData.reason && (
              <p className="text-xs text-gray-600 capitalize">
                Reason: {eventData.reason.replace('_', ' ')}
              </p>
            )}
            {eventData.winner && (
              <p className="text-xs text-green-600 font-medium">
                Winner: {eventData.winner}
              </p>
            )}
            {eventData.finalScore && (
              <p className="text-xs text-gray-600">
                Final Score: {eventData.finalScore}
              </p>
            )}
            {eventData.resolvedBy && (
              <p className="text-xs text-gray-500 capitalize">
                Resolved by: {eventData.resolvedBy}
              </p>
            )}
          </div>
        )

      default:
        return (
          <p className="text-sm text-gray-800">
            {eventType.replace('_', ' ')} event
          </p>
        )
    }
  }

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Events</h3>
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading events...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Events</h3>
        <div className="text-center py-8">
          <div className="text-4xl mb-2">⚠️</div>
          <p className="text-red-600 mb-2">Failed to load events</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={fetchEvents}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Recent Events</h3>
        <button
          onClick={fetchEvents}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          title="Refresh events"
        >
          🔄
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">📝</div>
          <p className="text-gray-500">No events recorded yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Match events will appear here as they happen
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {events.map((event) => (
            <div
              key={event.id}
              className={`p-3 rounded-lg border ${getEventColor(event.eventType)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <span className="text-lg">{getEventIcon(event.eventType)}</span>
                  <div className="flex-1 min-w-0">
                    {renderEventDescription(event)}
                  </div>
                </div>
                <div className="text-xs text-gray-500 ml-2 flex-shrink-0">
                  {formatTime(event.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {events.length > 0 && (
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Showing {events.length} recent events
          </p>
        </div>
      )}
    </div>
  )
}