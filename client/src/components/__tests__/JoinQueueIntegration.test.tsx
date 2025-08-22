import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { JoinQueueModal } from '../JoinQueueModal';
import { SocketProvider } from '../../contexts/SocketContext';
import { ToastProvider } from '../../contexts/ToastContext';

// Mock the hooks with realistic data
jest.mock('../../hooks/useRealtimeQueue', () => ({
  useRealtimeQueue: () => ({
    isQueueFull: false,
    queueData: {
      teams: [
        {
          id: '1',
          name: 'Existing Team',
          members: 3,
          status: 'waiting',
          wins: 0,
          lastSeen: new Date(),
          position: 1
        }
      ],
      totalTeams: 1,
      availableSlots: 9,
      maxSize: 10,
      lastUpdated: new Date()
    }
  })
}));

jest.mock('../../contexts/SocketContext', () => ({
  SocketProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useSocketContext: () => ({
    isConnected: true,
    emit: jest.fn()
  })
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ToastProvider>
      <SocketProvider>
        {component}
      </SocketProvider>
    </ToastProvider>
  );
};

describe('JoinQueueModal Integration Tests', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  it('should prevent duplicate team names', async () => {
    renderWithProviders(
      <JoinQueueModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const teamNameInput = screen.getByLabelText('Team Name *');
    fireEvent.change(teamNameInput, { target: { value: 'Existing Team' } });

    const submitButton = screen.getByRole('button', { name: 'Join Queue' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Team name already exists in queue')).toBeInTheDocument();
    });
  });

  it('should show queue statistics correctly', () => {
    renderWithProviders(
      <JoinQueueModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('1 teams')).toBeInTheDocument();
    expect(screen.getByText('9 slots')).toBeInTheDocument();
  });

  it('should handle successful form submission with all fields', async () => {
    const mockResponse = {
      success: true,
      data: {
        team: {
          id: '123',
          name: 'New Team',
          members: 4
        },
        position: 2,
        estimatedWaitTime: '15 minutes'
      },
      message: 'Team "New Team" successfully joined the queue at position 2'
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    renderWithProviders(
      <JoinQueueModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    // Fill out the form
    const teamNameInput = screen.getByLabelText('Team Name *');
    fireEvent.change(teamNameInput, { target: { value: 'New Team' } });

    const membersSelect = screen.getByLabelText('Number of Players *');
    fireEvent.change(membersSelect, { target: { value: '4' } });

    const contactInput = screen.getByLabelText('Contact Info (Optional)');
    fireEvent.change(contactInput, { target: { value: 'Line: newteam123' } });

    const submitButton = screen.getByRole('button', { name: 'Join Queue' });
    fireEvent.click(submitButton);

    // Verify API call
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/queue/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Team',
          members: 4,
          contactInfo: 'Line: newteam123'
        }),
      });
    });

    // Verify success callback
    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith({
        name: 'New Team',
        members: 4,
        position: 2
      });
    });

    // Verify success message is shown
    await waitFor(() => {
      expect(screen.getByText('Successfully Joined!')).toBeInTheDocument();
      expect(screen.getByText('Team "New Team" has been added to the queue.')).toBeInTheDocument();
    });
  });

  it('should handle form submission without optional contact info', async () => {
    const mockResponse = {
      success: true,
      data: {
        team: {
          id: '124',
          name: 'Simple Team',
          members: 2
        },
        position: 2
      }
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    renderWithProviders(
      <JoinQueueModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const teamNameInput = screen.getByLabelText('Team Name *');
    fireEvent.change(teamNameInput, { target: { value: 'Simple Team' } });

    // Leave contact info empty
    const submitButton = screen.getByRole('button', { name: 'Join Queue' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/queue/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Simple Team',
          members: 2,
          contactInfo: undefined
        }),
      });
    });
  });

  it('should handle network errors gracefully', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(
      <JoinQueueModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const teamNameInput = screen.getByLabelText('Team Name *');
    fireEvent.change(teamNameInput, { target: { value: 'Test Team' } });

    const submitButton = screen.getByRole('button', { name: 'Join Queue' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should disable submit button when queue is full', () => {
    // Mock queue full state
    jest.doMock('../../hooks/useRealtimeQueue', () => ({
      useRealtimeQueue: () => ({
        isQueueFull: true,
        queueData: {
          teams: Array.from({ length: 10 }, (_, i) => ({
            id: `${i + 1}`,
            name: `Team ${i + 1}`,
            members: 2,
            status: 'waiting',
            wins: 0,
            lastSeen: new Date(),
            position: i + 1
          })),
          totalTeams: 10,
          availableSlots: 0,
          maxSize: 10,
          lastUpdated: new Date()
        }
      })
    }));

    renderWithProviders(
      <JoinQueueModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const submitButton = screen.getByRole('button', { name: 'Join Queue' });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText('Queue is currently full')).toBeInTheDocument();
  });
});