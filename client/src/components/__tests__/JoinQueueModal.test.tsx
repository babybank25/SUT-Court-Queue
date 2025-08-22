import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import JoinQueueModal from '../JoinQueueModal';

// Mock the socket context
const mockEmit = vi.fn();
const mockUseSocket = vi.fn();
vi.mock('../../contexts/SocketContext', () => ({
  useSocket: () => mockUseSocket(),
}));

// Mock the toast context
const mockShowToast = vi.fn();
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

describe('JoinQueueModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSuccess: mockOnSuccess,
  };

  beforeEach(() => {
    mockUseSocket.mockReturnValue({
      socket: { emit: mockEmit },
      isConnected: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal when open', () => {
    render(<JoinQueueModal {...defaultProps} />);

    expect(screen.getByText('Join Queue')).toBeInTheDocument();
    expect(screen.getByLabelText('Team Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Number of Players')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact Info (Optional)')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<JoinQueueModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Join Queue')).not.toBeInTheDocument();
  });

  it('should handle form input changes', async () => {
    const user = userEvent.setup();
    render(<JoinQueueModal {...defaultProps} />);

    const teamNameInput = screen.getByLabelText('Team Name');
    const playersInput = screen.getByLabelText('Number of Players');
    const contactInput = screen.getByLabelText('Contact Info (Optional)');

    await user.type(teamNameInput, 'Test Team');
    await user.clear(playersInput);
    await user.type(playersInput, '5');
    await user.type(contactInput, 'test@example.com');

    expect(teamNameInput).toHaveValue('Test Team');
    expect(playersInput).toHaveValue(5);
    expect(contactInput).toHaveValue('test@example.com');
  });

  it('should validate required fields', async () => {
    const user = userEvent.setup();
    render(<JoinQueueModal {...defaultProps} />);

    const submitButton = screen.getByText('Join Queue');
    await user.click(submitButton);

    expect(screen.getByText('Team name is required')).toBeInTheDocument();
    expect(screen.getByText('Number of players is required')).toBeInTheDocument();
  });

  it('should validate team name length', async () => {
    const user = userEvent.setup();
    render(<JoinQueueModal {...defaultProps} />);

    const teamNameInput = screen.getByLabelText('Team Name');
    await user.type(teamNameInput, 'A');

    const submitButton = screen.getByText('Join Queue');
    await user.click(submitButton);

    expect(screen.getByText('Team name must be at least 2 characters')).toBeInTheDocument();
  });

  it('should validate player count range', async () => {
    const user = userEvent.setup();
    render(<JoinQueueModal {...defaultProps} />);

    const playersInput = screen.getByLabelText('Number of Players');
    
    // Test minimum
    await user.clear(playersInput);
    await user.type(playersInput, '0');
    
    const submitButton = screen.getByText('Join Queue');
    await user.click(submitButton);

    expect(screen.getByText('Must have at least 1 player')).toBeInTheDocument();

    // Test maximum
    await user.clear(playersInput);
    await user.type(playersInput, '11');
    await user.click(submitButton);

    expect(screen.getByText('Cannot have more than 10 players')).toBeInTheDocument();
  });

  it('should validate email format when provided', async () => {
    const user = userEvent.setup();
    render(<JoinQueueModal {...defaultProps} />);

    const teamNameInput = screen.getByLabelText('Team Name');
    const playersInput = screen.getByLabelText('Number of Players');
    const contactInput = screen.getByLabelText('Contact Info (Optional)');

    await user.type(teamNameInput, 'Test Team');
    await user.clear(playersInput);
    await user.type(playersInput, '5');
    await user.type(contactInput, 'invalid-email');

    const submitButton = screen.getByText('Join Queue');
    await user.click(submitButton);

    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
  });

  it('should submit form with valid data', async () => {
    const user = userEvent.setup();
    render(<JoinQueueModal {...defaultProps} />);

    const teamNameInput = screen.getByLabelText('Team Name');
    const playersInput = screen.getByLabelText('Number of Players');
    const contactInput = screen.getByLabelText('Contact Info (Optional)');

    await user.type(teamNameInput, 'Test Team');
    await user.clear(playersInput);
    await user.type(playersInput, '5');
    await user.type(contactInput, 'test@example.com');

    const submitButton = screen.getByText('Join Queue');
    await user.click(submitButton);

    expect(mockEmit).toHaveBeenCalledWith('join-queue', {
      name: 'Test Team',
      members: 5,
      contactInfo: 'test@example.com',
    });
  });

  it('should submit form without optional contact info', async () => {
    const user = userEvent.setup();
    render(<JoinQueueModal {...defaultProps} />);

    const teamNameInput = screen.getByLabelText('Team Name');
    const playersInput = screen.getByLabelText('Number of Players');

    await user.type(teamNameInput, 'Test Team');
    await user.clear(playersInput);
    await user.type(playersInput, '5');

    const submitButton = screen.getByText('Join Queue');
    await user.click(submitButton);

    expect(mockEmit).toHaveBeenCalledWith('join-queue', {
      name: 'Test Team',
      members: 5,
      contactInfo: '',
    });
  });

  it('should show loading state during submission', async () => {
    const user = userEvent.setup();
    render(<JoinQueueModal {...defaultProps} />);

    const teamNameInput = screen.getByLabelText('Team Name');
    const playersInput = screen.getByLabelText('Number of Players');

    await user.type(teamNameInput, 'Test Team');
    await user.clear(playersInput);
    await user.type(playersInput, '5');

    const submitButton = screen.getByText('Join Queue');
    await user.click(submitButton);

    expect(screen.getByText('Joining...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('should handle socket disconnection', () => {
    mockUseSocket.mockReturnValue({
      socket: null,
      isConnected: false,
    });

    render(<JoinQueueModal {...defaultProps} />);

    expect(screen.getByText('Connection lost. Please try again.')).toBeInTheDocument();
    expect(screen.getByText('Join Queue')).toBeDisabled();
  });

  it('should close modal on cancel', async () => {
    const user = userEvent.setup();
    render(<JoinQueueModal {...defaultProps} />);

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should close modal on backdrop click', async () => {
    const user = userEvent.setup();
    render(<JoinQueueModal {...defaultProps} />);

    const backdrop = screen.getByTestId('modal-backdrop');
    await user.click(backdrop);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should close modal on escape key', () => {
    render(<JoinQueueModal {...defaultProps} />);

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should handle successful queue join', async () => {
    const user = userEvent.setup();
    render(<JoinQueueModal {...defaultProps} />);

    const teamNameInput = screen.getByLabelText('Team Name');
    const playersInput = screen.getByLabelText('Number of Players');

    await user.type(teamNameInput, 'Test Team');
    await user.clear(playersInput);
    await user.type(playersInput, '5');

    const submitButton = screen.getByText('Join Queue');
    await user.click(submitButton);

    // Simulate successful response
    const mockSocket = mockUseSocket().socket;
    const notificationCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'notification'
    )?.[1];

    if (notificationCallback) {
      notificationCallback({
        type: 'success',
        title: 'Joined Queue',
        message: 'Team "Test Team" successfully joined at position 1',
      });
    }

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should handle queue join error', async () => {
    const user = userEvent.setup();
    render(<JoinQueueModal {...defaultProps} />);

    const teamNameInput = screen.getByLabelText('Team Name');
    const playersInput = screen.getByLabelText('Number of Players');

    await user.type(teamNameInput, 'Test Team');
    await user.clear(playersInput);
    await user.type(playersInput, '5');

    const submitButton = screen.getByText('Join Queue');
    await user.click(submitButton);

    // Simulate error response
    const mockSocket = mockUseSocket().socket;
    const errorCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'error'
    )?.[1];

    if (errorCallback) {
      errorCallback({
        code: 'TEAM_NAME_EXISTS',
        message: 'Team name already exists',
      });
    }

    await waitFor(() => {
      expect(screen.getByText('Team name already exists')).toBeInTheDocument();
      expect(screen.getByText('Join Queue')).not.toBeDisabled();
    });
  });

  it('should reset form after successful submission', async () => {
    const user = userEvent.setup();
    render(<JoinQueueModal {...defaultProps} />);

    const teamNameInput = screen.getByLabelText('Team Name');
    const playersInput = screen.getByLabelText('Number of Players');

    await user.type(teamNameInput, 'Test Team');
    await user.clear(playersInput);
    await user.type(playersInput, '5');

    const submitButton = screen.getByText('Join Queue');
    await user.click(submitButton);

    // Simulate successful response
    const mockSocket = mockUseSocket().socket;
    const notificationCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'notification'
    )?.[1];

    if (notificationCallback) {
      notificationCallback({
        type: 'success',
        title: 'Joined Queue',
        message: 'Successfully joined',
      });
    }

    await waitFor(() => {
      expect(teamNameInput).toHaveValue('');
      expect(playersInput).toHaveValue(1);
    });
  });

  it('should be accessible', () => {
    render(<JoinQueueModal {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Team Name')).toBeRequired();
    expect(screen.getByLabelText('Number of Players')).toBeRequired();
    expect(screen.getByLabelText('Contact Info (Optional)')).not.toBeRequired();
  });
});