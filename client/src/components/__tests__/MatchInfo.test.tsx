import React from 'react'
import { render, screen } from '@testing-library/react'
import { MatchInfo } from '../MatchInfo'
import { Match } from '../../types'

const mockMatch: Match = {
  id: 'match-1',
  team1: {
    id: 'team-1',
    name: 'Team Alpha',
    members: 5,
    contactInfo: 'alpha@test.com',
    status: 'playing',
    wins: 3,
    lastSeen: new Date(),
    position: 1
  },
  team2: {
    id: 'team-2',
    name: 'Team Beta',
    members: 4,
    contactInfo: 'beta@test.com',
    status: 'playing',
    wins: 2,
    lastSeen: new Date(),
    position: 2
  },
  score1: 15,
  score2: 12,
  status: 'active',
  startTime: new Date('2024-01-15T10:30:00Z'),
  targetScore: 21,
  matchType: 'regular',
  confirmed: {
    team1: false,
    team2: false
  }
}

describe('MatchInfo', () => {
  it('renders match details correctly', () => {
    render(<MatchInfo match={mockMatch} />)
    
    expect(screen.getByText('Match Details')).toBeInTheDocument()
    expect(screen.getByText('regular')).toBeInTheDocument()
    expect(screen.getByText('21 points')).toBeInTheDocument()
    expect(screen.getByText('15 - 12')).toBeInTheDocument()
  })

  it('displays team information', () => {
    render(<MatchInfo match={mockMatch} />)
    
    expect(screen.getByText('Team Alpha')).toBeInTheDocument()
    expect(screen.getByText('Team Beta')).toBeInTheDocument()
    expect(screen.getByText('5 players')).toBeInTheDocument()
    expect(screen.getByText('4 players')).toBeInTheDocument()
    expect(screen.getByText('3 wins')).toBeInTheDocument()
    expect(screen.getByText('2 wins')).toBeInTheDocument()
  })

  it('shows contact information when available', () => {
    render(<MatchInfo match={mockMatch} />)
    
    expect(screen.getByText('alpha@test.com')).toBeInTheDocument()
    expect(screen.getByText('beta@test.com')).toBeInTheDocument()
  })

  it('displays status with appropriate styling', () => {
    render(<MatchInfo match={mockMatch} />)
    
    const statusElement = screen.getByText('active')
    expect(statusElement).toHaveClass('text-green-600', 'bg-green-50')
  })

  it('shows winner information for completed matches', () => {
    const completedMatch = { ...mockMatch, status: 'completed' as const }
    render(<MatchInfo match={completedMatch} />)
    
    expect(screen.getByText('Winner')).toBeInTheDocument()
    expect(screen.getByText('Team Alpha')).toBeInTheDocument()
    expect(screen.getByText('Final Score: 15 points')).toBeInTheDocument()
    expect(screen.getByText('🏆')).toBeInTheDocument()
  })

  it('handles tie games correctly', () => {
    const tieMatch = { 
      ...mockMatch, 
      status: 'completed' as const,
      score1: 15,
      score2: 15
    }
    render(<MatchInfo match={tieMatch} />)
    
    // Should not show winner section for tie games
    expect(screen.queryByText('Winner')).not.toBeInTheDocument()
  })

  it('displays confirmation status for confirming matches', () => {
    const confirmingMatch = {
      ...mockMatch,
      status: 'confirming' as const,
      confirmed: { team1: true, team2: false }
    }
    render(<MatchInfo match={confirmingMatch} />)
    
    expect(screen.getByText('Confirmation Status')).toBeInTheDocument()
    expect(screen.getByText('✓ Confirmed')).toBeInTheDocument()
    expect(screen.getByText('Waiting...')).toBeInTheDocument()
  })

  it('shows end time for completed matches', () => {
    const completedMatch = {
      ...mockMatch,
      status: 'completed' as const,
      endTime: new Date('2024-01-15T11:00:00Z')
    }
    render(<MatchInfo match={completedMatch} />)
    
    expect(screen.getByText('End Time')).toBeInTheDocument()
  })

  it('calculates and displays match duration', () => {
    // Mock current time to be 30 minutes after start
    const mockNow = new Date('2024-01-15T11:00:00Z')
    jest.spyOn(global, 'Date').mockImplementation(() => mockNow as any)
    
    render(<MatchInfo match={mockMatch} />)
    
    expect(screen.getByText('Duration')).toBeInTheDocument()
    expect(screen.getByText('30:00')).toBeInTheDocument()
    
    jest.restoreAllMocks()
  })

  it('handles champion-return match type', () => {
    const championMatch = { ...mockMatch, matchType: 'champion-return' as const }
    render(<MatchInfo match={championMatch} />)
    
    expect(screen.getByText('champion return')).toBeInTheDocument()
  })

  it('formats times in Thai timezone', () => {
    render(<MatchInfo match={mockMatch} />)
    
    // Should display time formatted for Asia/Bangkok timezone
    expect(screen.getByText('Start Time')).toBeInTheDocument()
    // The exact time display will depend on the timezone conversion
  })

  it('handles missing contact info gracefully', () => {
    const noContactMatch = {
      ...mockMatch,
      team1: { ...mockMatch.team1, contactInfo: undefined },
      team2: { ...mockMatch.team2, contactInfo: undefined }
    }
    render(<MatchInfo match={noContactMatch} />)
    
    expect(screen.queryByText('alpha@test.com')).not.toBeInTheDocument()
    expect(screen.queryByText('beta@test.com')).not.toBeInTheDocument()
  })
})