import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import QueueList from '../QueueList';
import { Team } from '../../types';

// Mock the RealtimeDataContext
const mockUseRealtimeData = vi.fn();
vi.mock('../../contexts/RealtimeDataContext', () => ({
  useRealtimeData: () => mockUseRealtimeData(),
}));

describe('QueueList', () => {
  const mockTeams: Team[] = [
    {
      id: '1',
      name: 'Team Alpha',
      members: 5,
      contactInfo: 'alpha@test.com',
      status: 'waiting',
      wins: 3,
      position: 1,
      lastSeen: new Date(),
    },
    {
      id: '2',
      name: 'Team Beta',
      members: 4,
      contactInfo: 'beta@test.com',
      status: 'waiting',
      wins: 1,
      position: 2,
      lastSeen: new Date(),
    },
    {
      id: '3',
      name: 'Team Gamma',
      members: 5,
      contactInfo: 'gamma@test.com',
      status: 'waiting',
      wins: 0,
      position: 3,
      lastSeen: new Date(),
    },
  ];

  beforeEach(() => {
    mockUseRealtimeData.mockReturnValue({
      queueData: {
        teams: mockTeams,
        totalTeams: 3,
        availableSlots: 7,
      },
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render queue list with teams', () => {
    render(<QueueList />);

    expect(screen.getByText('Current Queue')).toBeInTheDocument();
    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    expect(screen.getByText('Team Beta')).toBeInTheDocument();
    expect(screen.getByText('Team Gamma')).toBeInTheDocument();
  });

  it('should display team positions correctly', () => {
    render(<QueueList />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should display team member counts', () => {
    render(<QueueList />);

    expect(screen.getByText('5 players')).toBeInTheDocument();
    expect(screen.getByText('4 players')).toBeInTheDocument();
  });

  it('should display team win counts', () => {
    render(<QueueList />);

    expect(screen.getByText('3 wins')).toBeInTheDocument();
    expect(screen.getByText('1 win')).toBeInTheDocument();
    expect(screen.getByText('0 wins')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    mockUseRealtimeData.mockReturnValue({
      queueData: null,
      isLoading: true,
      error: null,
    });

    render(<QueueList />);

    expect(screen.getByText('Loading queue...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    mockUseRealtimeData.mockReturnValue({
      queueData: null,
      isLoading: false,
      error: 'Failed to load queue data',
    });

    render(<QueueList />);

    expect(screen.getByText('Error loading queue')).toBeInTheDocument();
    expect(screen.getByText('Failed to load queue data')).toBeInTheDocument();
  });

  it('should show empty queue message', () => {
    mockUseRealtimeData.mockReturnValue({
      queueData: {
        teams: [],
        totalTeams: 0,
        availableSlots: 10,
      },
      isLoading: false,
      error: null,
    });

    render(<QueueList />);

    expect(screen.getByText('No teams in queue')).toBeInTheDocument();
    expect(screen.getByText('Be the first to join!')).toBeInTheDocument();
  });

  it('should display queue statistics', () => {
    render(<QueueList />);

    expect(screen.getByText('3 teams waiting')).toBeInTheDocument();
    expect(screen.getByText('7 slots available')).toBeInTheDocument();
  });

  it('should highlight first team in queue', () => {
    render(<QueueList />);

    const firstTeamElement = screen.getByText('Team Alpha').closest('.queue-item');
    expect(firstTeamElement).toHaveClass('next-up');
  });

  it('should show estimated wait times', () => {
    render(<QueueList />);

    expect(screen.getByText('Next up!')).toBeInTheDocument();
    expect(screen.getByText('~15 min')).toBeInTheDocument();
    expect(screen.getByText('~30 min')).toBeInTheDocument();
  });

  it('should handle team status indicators', () => {
    const teamsWithDifferentStatuses = [
      { ...mockTeams[0], status: 'waiting' as const },
      { ...mockTeams[1], status: 'playing' as const },
      { ...mockTeams[2], status: 'cooldown' as const },
    ];

    mockUseRealtimeData.mockReturnValue({
      queueData: {
        teams: teamsWithDifferentStatuses,
        totalTeams: 3,
        availableSlots: 7,
      },
      isLoading: false,
      error: null,
    });

    render(<QueueList />);

    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.getByText('Playing')).toBeInTheDocument();
    expect(screen.getByText('Cooldown')).toBeInTheDocument();
  });

  it('should be responsive on mobile', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    render(<QueueList />);

    const queueContainer = screen.getByTestId('queue-list-container');
    expect(queueContainer).toHaveClass('mobile-layout');
  });

  it('should update when queue data changes', () => {
    const { rerender } = render(<QueueList />);

    expect(screen.getByText('Team Alpha')).toBeInTheDocument();

    // Update mock data
    const updatedTeams = [
      ...mockTeams,
      {
        id: '4',
        name: 'Team Delta',
        members: 3,
        contactInfo: 'delta@test.com',
        status: 'waiting' as const,
        wins: 2,
        position: 4,
        lastSeen: new Date(),
      },
    ];

    mockUseRealtimeData.mockReturnValue({
      queueData: {
        teams: updatedTeams,
        totalTeams: 4,
        availableSlots: 6,
      },
      isLoading: false,
      error: null,
    });

    rerender(<QueueList />);

    expect(screen.getByText('Team Delta')).toBeInTheDocument();
    expect(screen.getByText('4 teams waiting')).toBeInTheDocument();
    expect(screen.getByText('6 slots available')).toBeInTheDocument();
  });
});