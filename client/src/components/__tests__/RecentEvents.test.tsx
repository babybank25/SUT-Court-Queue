import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { RecentEvents } from '../RecentEvents'

// Mock fetch
global.fetch = jest.fn()

const mockEvents = [
  {
    id: 1,
    matchId: 'test-match-1',
    eventType: 'score_update',
    eventData: {
      score1: 5,
      score2: 3,
      previousScore1: 4,
      previousScore2: 3,
      team1Name: 'Team A',
      team2Name: 'Team B'
    },
    createdAt: new Date('2024-01-01T10:00:00Z')
  },
  {
    id: 2,
    matchId: 'test-match-1',
    eventType: 'status_change',
    eventData: {
      status: 'confirming',
      previousStatus: 'active',
      reason: 'target_score_reached',
      targetScore: 21
    },
    createdAt: new Date('2024-01-01T10:01:00Z')
  },
  {
    id: 3,
    matchId: 'test-match-1',
    eventType: 'confirmation',
    eventData: {
      teamName: 'Team A',
      confirmed: true,
      bothConfirmed: false
    },
    createdAt: new Date('2024-01-01T10:02:00Z')
  }
]

describe('RecentEvents Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state initially', () => {
    ;(fetch as jest.Mock).mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<RecentEvents matchId="test-match-1" />)

    expect(screen.getByText('Recent Events')).toBeInTheDocument()
    expect(screen.getByText('Loading events...')).toBeInTheDocument()
  })

  it('renders events successfully', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: {
          events: mockEvents,
          matchId: 'test-match-1',
          totalEvents: 3
        }
      })
    })

    render(<RecentEvents matchId="test-match-1" />)

    await waitFor(() => {
      expect(screen.getByText('Recent Events')).toBeInTheDocument()
    })

    // Check for score update event
    expect(screen.getByText('Score Update: 5 - 3')).toBeInTheDocument()
    expect(screen.getByText('Previous: 4 - 3')).toBeInTheDocument()
    expect(screen.getByText('Team A vs Team B')).toBeInTheDocument()

    // Check for status change event
    expect(screen.getByText('Status: confirming')).toBeInTheDocument()
    expect(screen.getByText('From: active')).toBeInTheDocument()
    expect(screen.getByText('Reason: target score reached')).toBeInTheDocument()

    // Check for confirmation event
    expect(screen.getByText('Team A confirmed the result')).toBeInTheDocument()

    // Check event count
    expect(screen.getByText('Showing 3 recent events')).toBeInTheDocument()
  })

  it('renders error state when fetch fails', async () => {
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    render(<RecentEvents matchId="test-match-1" />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load events')).toBeInTheDocument()
    })

    expect(screen.getByText('Network error')).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  it('renders empty state when no events exist', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: {
          events: [],
          matchId: 'test-match-1',
          totalEvents: 0
        }
      })
    })

    render(<RecentEvents matchId="test-match-1" />)

    await waitFor(() => {
      expect(screen.getByText('No events recorded yet')).toBeInTheDocument()
    })

    expect(screen.getByText('Match events will appear here as they happen')).toBeInTheDocument()
  })

  it('calls correct API endpoint', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: { events: [], matchId: 'test-match-1', totalEvents: 0 }
      })
    })

    render(<RecentEvents matchId="test-match-123" />)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/match/test-match-123/events')
    })
  })

  it('handles different event types correctly', async () => {
    const timeoutEvent = {
      id: 4,
      matchId: 'test-match-1',
      eventType: 'timeout',
      eventData: {
        reason: 'confirmation_timeout',
        winner: 'Team A',
        finalScore: '21-15',
        resolvedBy: 'system'
      },
      createdAt: new Date('2024-01-01T10:03:00Z')
    }

    ;(fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: {
          events: [timeoutEvent],
          matchId: 'test-match-1',
          totalEvents: 1
        }
      })
    })

    render(<RecentEvents matchId="test-match-1" />)

    await waitFor(() => {
      expect(screen.getByText('Match resolved by timeout')).toBeInTheDocument()
    })

    expect(screen.getByText('Reason: confirmation timeout')).toBeInTheDocument()
    expect(screen.getByText('Winner: Team A')).toBeInTheDocument()
    expect(screen.getByText('Final Score: 21-15')).toBeInTheDocument()
    expect(screen.getByText('Resolved by: system')).toBeInTheDocument()
  })
})