import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JoinQueueModal } from '../JoinQueueModal';
import { ToastProvider } from '../../contexts/ToastContext';

// Mock fetch
global.fetch = jest.fn();

const JoinQueueWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ToastProvider>
    {children}
  </ToastProvider>
);

describe('JoinQueueModal Integration', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { message: 'Team added to queue successfully' }
      })
    });
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();

    render(
      <JoinQueueWrapper>
        <JoinQueueModal 
          isOpen={true} 
          onClose={mockOnClose} 
          onSuccess={mockOnSuccess} 
        />
      </JoinQueueWrapper>
    );

    // Fill out the form
    await user.type(screen.getByLabelText(/team name/i), 'Team Alpha');
    await user.selectOptions(screen.getByLabelText(/number of players/i), '5');
    await user.type(screen.getByLabelText(/contact info/i), 'captain@example.com');

    // Submit the form
    await user.click(screen.getByRole('button', { name: /join queue/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/queue/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Team Alpha',
          members: 5,
          contactInfo: 'captain@example.com'
        })
      });
    });

    expect(mockOnSuccess).toHaveBeenCalled();
  });

  it('shows validation errors for invalid input', async () => {
    const user = userEvent.setup();

    render(
      <JoinQueueWrapper>
        <JoinQueueModal 
          isOpen={true} 
          onClose={mockOnClose} 
          onSuccess={mockOnSuccess} 
        />
      </JoinQueueWrapper>
    );

    // Try to submit without filling required fields
    await user.click(screen.getByRole('button', { name: /join queue/i }));

    await waitFor(() => {
      expect(screen.getByText(/team name is required/i)).toBeInTheDocument();
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('handles server validation errors', async () => {
    const user = userEvent.setup();

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          message: 'Team name already exists',
          fieldErrors: {
            name: 'This team name is already in use'
          }
        }
      })
    });

    render(
      <JoinQueueWrapper>
        <JoinQueueModal 
          isOpen={true} 
          onClose={mockOnClose} 
          onSuccess={mockOnSuccess} 
        />
      </JoinQueueWrapper>
    );

    // Fill out the form
    await user.type(screen.getByLabelText(/team name/i), 'Existing Team');
    await user.selectOptions(screen.getByLabelText(/number of players/i), '5');

    // Submit the form
    await user.click(screen.getByRole('button', { name: /join queue/i }));

    await waitFor(() => {
      expect(screen.getByText('This team name is already in use')).toBeInTheDocument();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('handles network errors', async () => {
    const user = userEvent.setup();

    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(
      <JoinQueueWrapper>
        <JoinQueueModal 
          isOpen={true} 
          onClose={mockOnClose} 
          onSuccess={mockOnSuccess} 
        />
      </JoinQueueWrapper>
    );

    // Fill out the form
    await user.type(screen.getByLabelText(/team name/i), 'Team Beta');
    await user.selectOptions(screen.getByLabelText(/number of players/i), '4');

    // Submit the form
    await user.click(screen.getByRole('button', { name: /join queue/i }));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('sanitizes input data', async () => {
    const user = userEvent.setup();

    render(
      <JoinQueueWrapper>
        <JoinQueueModal 
          isOpen={true} 
          onClose={mockOnClose} 
          onSuccess={mockOnSuccess} 
        />
      </JoinQueueWrapper>
    );

    // Fill out the form with data that needs sanitization
    await user.type(screen.getByLabelText(/team name/i), '  Team Gamma  ');
    await user.type(screen.getByLabelText(/contact info/i), '  captain@example.com  ');

    // Submit the form
    await user.click(screen.getByRole('button', { name: /join queue/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/queue/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Team Gamma',
          members: 5, // default value
          contactInfo: 'captain@example.com'
        })
      });
    });
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();

    // Mock a delayed response
    (fetch as jest.Mock).mockImplementation(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true, data: {} })
        }), 100)
      )
    );

    render(
      <JoinQueueWrapper>
        <JoinQueueModal 
          isOpen={true} 
          onClose={mockOnClose} 
          onSuccess={mockOnSuccess} 
        />
      </JoinQueueWrapper>
    );

    // Fill out the form
    await user.type(screen.getByLabelText(/team name/i), 'Team Delta');

    // Submit the form
    await user.click(screen.getByRole('button', { name: /join queue/i }));

    // Should show loading state
    expect(screen.getByText(/joining/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /joining/i })).toBeDisabled();

    // Wait for completion
    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('closes modal when cancel is clicked', async () => {
    const user = userEvent.setup();

    render(
      <JoinQueueWrapper>
        <JoinQueueModal 
          isOpen={true} 
          onClose={mockOnClose} 
          onSuccess={mockOnSuccess} 
        />
      </JoinQueueWrapper>
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('validates team name length', async () => {
    const user = userEvent.setup();

    render(
      <JoinQueueWrapper>
        <JoinQueueModal 
          isOpen={true} 
          onClose={mockOnClose} 
          onSuccess={mockOnSuccess} 
        />
      </JoinQueueWrapper>
    );

    // Enter a very long team name
    const longName = 'A'.repeat(51); // Assuming max length is 50
    await user.type(screen.getByLabelText(/team name/i), longName);

    await user.click(screen.getByRole('button', { name: /join queue/i }));

    await waitFor(() => {
      expect(screen.getByText(/team name is too long/i)).toBeInTheDocument();
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('validates contact info format', async () => {
    const user = userEvent.setup();

    render(
      <JoinQueueWrapper>
        <JoinQueueModal 
          isOpen={true} 
          onClose={mockOnClose} 
          onSuccess={mockOnSuccess} 
        />
      </JoinQueueWrapper>
    );

    await user.type(screen.getByLabelText(/team name/i), 'Team Echo');
    await user.type(screen.getByLabelText(/contact info/i), 'invalid-email');

    await user.click(screen.getByRole('button', { name: /join queue/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid contact info format/i)).toBeInTheDocument();
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('handles queue full scenario', async () => {
    const user = userEvent.setup();

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        error: {
          message: 'Queue is full',
          code: 'QUEUE_FULL'
        }
      })
    });

    render(
      <JoinQueueWrapper>
        <JoinQueueModal 
          isOpen={true} 
          onClose={mockOnClose} 
          onSuccess={mockOnSuccess} 
        />
      </JoinQueueWrapper>
    );

    await user.type(screen.getByLabelText(/team name/i), 'Team Foxtrot');
    await user.click(screen.getByRole('button', { name: /join queue/i }));

    await waitFor(() => {
      expect(screen.getByText('Queue is full')).toBeInTheDocument();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });
});