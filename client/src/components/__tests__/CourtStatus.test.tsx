import React from 'react';
import { render, screen } from '@testing-library/react';
import { CourtStatus } from '../CourtStatus';
import { useRealtimeCourtStatus } from '../../hooks/useRealtimeCourtStatus';

// Mock the useRealtimeCourtStatus hook
jest.mock('../../hooks/useRealtimeCourtStatus');

const mockUseRealtimeCourtStatus = useRealtimeCourtStatus as jest.MockedFunction<typeof useRealtimeCourtStatus>;

describe('CourtStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    mockUseRealtimeCourtStatus.mockReturnValue({
      courtStatus: {
        isOpen: true,
        currentTime: new Date().toISOString(),
        timezone: 'Asia/Bangkok',
        mode: 'regular',
        activeMatches: 0
      },
      isLoading: true,
      error: null,
      isConnected: true,
      isCourtOpen: true,
      isInCooldown: jest.fn(() => false),
      isChampionReturnMode: false,
      isRegularMode: true,
      hasActiveMatches: false,
      activeMatchCount: 0,
      getFormattedTime: jest.fn(() => '10:30:45'),
      getFormattedCooldownTime: jest.fn(() => '0:00'),
      cooldownTimeRemaining: 0,
      refetch: jest.fn()
    });

    render(<CourtStatus />);
    
    expect(screen.getByText('Loading court status...')).toBeInTheDocument();
  });

  it('renders court available state', () => {
    mockUseRealtimeCourtStatus.mockReturnValue({
      courtStatus: {
        isOpen: true,
        currentTime: new Date().toISOString(),
        timezone: 'Asia/Bangkok',
        mode: 'regular',
        activeMatches: 0
      },
      isLoading: false,
      error: null,
      isConnected: true,
      isCourtOpen: true,
      isInCooldown: jest.fn(() => false),
      isChampionReturnMode: false,
      isRegularMode: true,
      hasActiveMatches: false,
      activeMatchCount: 0,
      getFormattedTime: jest.fn(() => '10:30:45'),
      getFormattedCooldownTime: jest.fn(() => '0:00'),
      cooldownTimeRemaining: 0,
      refetch: jest.fn()
    });

    render(<CourtStatus />);
    
    expect(screen.getByText('Court Available')).toBeInTheDocument();
    expect(screen.getByText('Regular Mode')).toBeInTheDocument();
    expect(screen.getByText('10:30:45')).toBeInTheDocument();
  });

  it('renders court closed state', () => {
    mockUseRealtimeCourtStatus.mockReturnValue({
      courtStatus: {
        isOpen: false,
        currentTime: new Date().toISOString(),
        timezone: 'Asia/Bangkok',
        mode: 'regular',
        activeMatches: 0
      },
      isLoading: false,
      error: null,
      isConnected: true,
      isCourtOpen: false,
      isInCooldown: jest.fn(() => false),
      isChampionReturnMode: false,
      isRegularMode: true,
      hasActiveMatches: false,
      activeMatchCount: 0,
      getFormattedTime: jest.fn(() => '10:30:45'),
      getFormattedCooldownTime: jest.fn(() => '0:00'),
      cooldownTimeRemaining: 0,
      refetch: jest.fn()
    });

    render(<CourtStatus />);
    
    expect(screen.getByText('Court Closed')).toBeInTheDocument();
    expect(screen.getByText('Court is currently closed for maintenance')).toBeInTheDocument();
  });

  it('renders champion return mode with cooldown', () => {
    mockUseRealtimeCourtStatus.mockReturnValue({
      courtStatus: {
        isOpen: true,
        currentTime: new Date().toISOString(),
        timezone: 'Asia/Bangkok',
        mode: 'champion-return',
        activeMatches: 1,
        cooldownEnd: new Date(Date.now() + 300000).toISOString() // 5 minutes from now
      },
      isLoading: false,
      error: null,
      isConnected: true,
      isCourtOpen: true,
      isInCooldown: jest.fn(() => true),
      isChampionReturnMode: true,
      isRegularMode: false,
      hasActiveMatches: true,
      activeMatchCount: 1,
      getFormattedTime: jest.fn(() => '10:30:45'),
      getFormattedCooldownTime: jest.fn(() => '5:00'),
      cooldownTimeRemaining: 300,
      refetch: jest.fn()
    });

    render(<CourtStatus />);
    
    expect(screen.getByText('Champion Return Mode')).toBeInTheDocument();
    expect(screen.getByText('Champion Return')).toBeInTheDocument();
    expect(screen.getByText('Cooldown Active')).toBeInTheDocument();
    expect(screen.getByText('5:00')).toBeInTheDocument();
  });

  it('renders error state', () => {
    mockUseRealtimeCourtStatus.mockReturnValue({
      courtStatus: {
        isOpen: true,
        currentTime: new Date().toISOString(),
        timezone: 'Asia/Bangkok',
        mode: 'regular',
        activeMatches: 0
      },
      isLoading: false,
      error: 'Failed to load court status',
      isConnected: false,
      isCourtOpen: true,
      isInCooldown: jest.fn(() => false),
      isChampionReturnMode: false,
      isRegularMode: true,
      hasActiveMatches: false,
      activeMatchCount: 0,
      getFormattedTime: jest.fn(() => '10:30:45'),
      getFormattedCooldownTime: jest.fn(() => '0:00'),
      cooldownTimeRemaining: 0,
      refetch: jest.fn()
    });

    render(<CourtStatus />);
    
    expect(screen.getByText('Error Loading Court Status')).toBeInTheDocument();
    expect(screen.getByText('Failed to load court status')).toBeInTheDocument();
  });

  it('shows connection status', () => {
    mockUseRealtimeCourtStatus.mockReturnValue({
      courtStatus: {
        isOpen: true,
        currentTime: new Date().toISOString(),
        timezone: 'Asia/Bangkok',
        mode: 'regular',
        activeMatches: 0
      },
      isLoading: false,
      error: null,
      isConnected: true,
      isCourtOpen: true,
      isInCooldown: jest.fn(() => false),
      isChampionReturnMode: false,
      isRegularMode: true,
      hasActiveMatches: false,
      activeMatchCount: 0,
      getFormattedTime: jest.fn(() => '10:30:45'),
      getFormattedCooldownTime: jest.fn(() => '0:00'),
      cooldownTimeRemaining: 0,
      refetch: jest.fn()
    });

    render(<CourtStatus />);
    
    expect(screen.getByText('Live')).toBeInTheDocument();
  });
});