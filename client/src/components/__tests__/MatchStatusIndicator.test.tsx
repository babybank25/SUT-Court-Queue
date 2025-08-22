import React from 'react'
import { render, screen } from '@testing-library/react'
import { MatchStatusIndicator } from '../MatchStatusIndicator'
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
  startTime: new Date(),
  targetScore: 21,
  matchType: 'regular',
  confirmed: {
    team1: false,
    team2: false
  }
}

describe('MatchStatusIndicator', () => {
  it('displays active match status correctly', () => {
    render(<MatchStatusIndicator match={mockMatch} />)
    
    expect(screen.getByText('🔴')).toBeInTheDocument()
    expect(screen.getByText('LIVE MATCH')).toBeInTheDocument()
    expect(screen.getByText('Match is currently in progress')).toBeInTheDocument()
    expect(screen.getByText('15 - 12')).toBeInTheDocument()
  })

  it('shows target score and match type for active matches', () => {
    render(<MatchStatusIndicator match={mockMatch} />)
    
    expect(screen.getByText('Target Score:')).toBeInTheDocument()
    expect(screen.getByText('21')).toBeInTheDocument()
    expect(screen.getByText('Match Type:')).toBeInTheDocument()
    expect(screen.getByText('regular')).toBeInTheDocument()
  })

  it('displays confirming match status correctly', () => {
    const confirmingMatch = {
      ...mockMatch,
      status: 'confirming' as const,
      confirmed: { team1: true, team2: false }
    }
    render(<MatchStatusIndicator match={confirmingMatch} />)
    
    expect(screen.getByText('⏳')).toBeInTheDocument()
    expect(screen.getByText('AWAITING CONFIRMATION')).toBeInTheDocument()
    expect(screen.getByText('Teams are confirming the match result')).toBeInTheDocument()
    expect(screen.getByText('Confirmation Status:')).toBeInTheDocument()
  })

  it('shows confirmation details for confirming matches', () => {
    const confirmingMatch = {
      ...mockMatch,
      status: 'confirming' as const,
      confirmed: { team1: true, team2: false }
    }
    render(<MatchStatusIndicator match={confirmingMatch} />)
    
    expect(screen.getByText('Team Alpha')).toBeInTheDocument()
    expect(screen.getByText('Team Beta')).toBeInTheDocument()
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.getByText('Waiting')).toBeInTheDocument()
  })

  it('shows both confirmed message when both teams confirm', () => {
    const bothConfirmedMatch = {
      ...mockMatch,
      status: 'confirming' as const,
      confirmed: { team1: true, team2: true }
    }
    render(<MatchStatusIndicator match={bothConfirmedMatch} />)
    
    expect(screen.getByText('✓ Both teams have confirmed the result')).toBeInTheDocument()
  })

  it('displays completed match status with winner', () => {
    const completedMatch = { ...mockMatch, status: 'completed' as const }
    render(<MatchStatusIndicator match={completedMatch} />)
    
    expect(screen.getByText('✅')).toBeInTheDocument()
    expect(screen.getByText('MATCH COMPLETED')).toBeInTheDocument()
    expect(screen.getByText('Match has been completed and confirmed')).toBeInTheDocument()
    expect(screen.getByText('🏆')).toBeInTheDocument()
    expect(screen.getByText('Team Alpha')).toBeInTheDocument() // Winner
    expect(screen.getByText('Final Score: 15-12')).toBeInTheDocument()
  })

  it('handles tie games correctly', () => {
    const tieMatch = {
      ...mockMatch,
      status: 'completed' as const,
      score1: 15,
      score2: 15
    }
    render(<MatchStatusIndicator match={tieMatch} />)
    
    expect(screen.getByText('Tie Game')).toBeInTheDocument()
    expect(screen.getByText('Final Score: 15-15')).toBeInTheDocument()
  })

  it('applies correct styling for different statuses', () => {
    const { rerender } = render(<MatchStatusIndicator match={mockMatch} />)
    
    // Active match should have red styling
    expect(screen.getByText('LIVE MATCH')).toHaveClass('bg-red-500', 'animate-pulse')
    
    // Confirming match should have yellow styling
    const confirmingMatch = { ...mockMatch, status: 'confirming' as const }
    rerender(<MatchStatusIndicator match={confirmingMatch} />)
    expect(screen.getByText('AWAITING CONFIRMATION')).toHaveClass('bg-yellow-500')
    
    // Completed match should have green styling
    const completedMatch = { ...mockMatch, status: 'completed' as const }
    rerender(<MatchStatusIndicator match={completedMatch} />)
    expect(screen.getByText('MATCH COMPLETED')).toHaveClass('bg-green-500')
  })

  it('handles champion-return match type display', () => {
    const championMatch = { ...mockMatch, matchType: 'champion-return' as const }
    render(<MatchStatusIndicator match={championMatch} />)
    
    expect(screen.getByText('champion return')).toBeInTheDocument()
  })

  it('applies custom className prop', () => {
    const { container } = render(
      <MatchStatusIndicator match={mockMatch} className="custom-class" />
    )
    
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('shows live score in header for active matches', () => {
    render(<MatchStatusIndicator match={mockMatch} />)
    
    expect(screen.getByText('Live Score')).toBeInTheDocument()
    expect(screen.getByText('15 - 12')).toBeInTheDocument()
  })
})