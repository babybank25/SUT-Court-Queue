import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocketProvider, useSocket } from '../SocketContext';
import { ReactNode } from 'react';

// Mock the useSocket hook
const mockUseSocketHook = vi.fn();
vi.mock('../../hooks/useSocket', () => ({
  useSocket: () => mockUseSocketHook(),
}));

// Test component that uses the socket context
const TestComponent = () => {
  const { socket, isConnected, emit, on, off } = useSocket();
  
  return (
    <div>
      <div data-testid="connection-status">
        {isConnected ? 'Connected' : 'Disconnected'}
      </div>
      <div data-testid="socket-id">
        {socket?.id || 'No socket'}
      </div>
      <button 
        onClick={() => emit('test-event', { data: 'test' })}
        data-testid="emit-button"
      >
        Emit Event
      </button>
      <button 
        onClick={() => on('test-event', () => {})}
        data-testid="on-button"
      >
        Add Listener
      </button>
      <button 
        onClick={() => off('test-event', () => {})}
        data-testid="off-button"
      >
        Remove Listener
      </button>
    </div>
  );
};

const renderWithProvider = (children: ReactNode, serverUrl?: string) => {
  return render(
    <SocketProvider serverUrl={serverUrl}>
      {children}
    </SocketProvider>
  );
};

describe('SocketContext', () => {
  const mockSocket = {
    id: 'socket-123',
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    connected: true,
  };

  beforeEach(() => {
    mockUseSocketHook.mockReturnValue({
      socket: mockSocket,
      isConnected: true,
      emit: mockSocket.emit,
      on: mockSocket.on,
      off: mockSocket.off,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should provide socket context to children', () => {
    renderWithProvider(<TestComponent />);

    expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
    expect(screen.getByTestId('socket-id')).toHaveTextContent('socket-123');
  });

  it('should handle disconnected state', () => {
    mockUseSocketHook.mockReturnValue({
      socket: null,
      isConnected: false,
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    });

    renderWithProvider(<TestComponent />);

    expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
    expect(screen.getByTestId('socket-id')).toHaveTextContent('No socket');
  });

  it('should allow emitting events', () => {
    renderWithProvider(<TestComponent />);

    const emitButton = screen.getByTestId('emit-button');
    act(() => {
      emitButton.click();
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
  });

  it('should allow adding event listeners', () => {
    renderWithProvider(<TestComponent />);

    const onButton = screen.getByTestId('on-button');
    act(() => {
      onButton.click();
    });

    expect(mockSocket.on).toHaveBeenCalledWith('test-event', expect.any(Function));
  });

  it('should allow removing event listeners', () => {
    renderWithProvider(<TestComponent />);

    const offButton = screen.getByTestId('off-button');
    act(() => {
      offButton.click();
    });

    expect(mockSocket.off).toHaveBeenCalledWith('test-event', expect.any(Function));
  });

  it('should use default server URL', () => {
    renderWithProvider(<TestComponent />);

    expect(mockUseSocketHook).toHaveBeenCalledWith('http://localhost:3001');
  });

  it('should use custom server URL', () => {
    renderWithProvider(<TestComponent />, 'http://custom-server:3000');

    expect(mockUseSocketHook).toHaveBeenCalledWith('http://custom-server:3000');
  });

  it('should throw error when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useSocket must be used within a SocketProvider');

    consoleSpy.mockRestore();
  });

  it('should handle connection state changes', () => {
    const { rerender } = renderWithProvider(<TestComponent />);

    expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');

    // Simulate disconnection
    mockUseSocketHook.mockReturnValue({
      socket: mockSocket,
      isConnected: false,
      emit: mockSocket.emit,
      on: mockSocket.on,
      off: mockSocket.off,
    });

    rerender(
      <SocketProvider>
        <TestComponent />
      </SocketProvider>
    );

    expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
  });

  it('should handle socket instance changes', () => {
    const { rerender } = renderWithProvider(<TestComponent />);

    expect(screen.getByTestId('socket-id')).toHaveTextContent('socket-123');

    // Simulate new socket instance
    const newSocket = { ...mockSocket, id: 'socket-456' };
    mockUseSocketHook.mockReturnValue({
      socket: newSocket,
      isConnected: true,
      emit: newSocket.emit,
      on: newSocket.on,
      off: newSocket.off,
    });

    rerender(
      <SocketProvider>
        <TestComponent />
      </SocketProvider>
    );

    expect(screen.getByTestId('socket-id')).toHaveTextContent('socket-456');
  });

  it('should provide stable function references', () => {
    const TestStabilityComponent = () => {
      const { emit, on, off } = useSocket();
      
      return (
        <div>
          <div data-testid="emit-ref">{emit.toString()}</div>
          <div data-testid="on-ref">{on.toString()}</div>
          <div data-testid="off-ref">{off.toString()}</div>
        </div>
      );
    };

    const { rerender } = renderWithProvider(<TestStabilityComponent />);

    const initialEmitRef = screen.getByTestId('emit-ref').textContent;
    const initialOnRef = screen.getByTestId('on-ref').textContent;
    const initialOffRef = screen.getByTestId('off-ref').textContent;

    rerender(
      <SocketProvider>
        <TestStabilityComponent />
      </SocketProvider>
    );

    expect(screen.getByTestId('emit-ref')).toHaveTextContent(initialEmitRef!);
    expect(screen.getByTestId('on-ref')).toHaveTextContent(initialOnRef!);
    expect(screen.getByTestId('off-ref')).toHaveTextContent(initialOffRef!);
  });

  it('should handle multiple children', () => {
    const ChildComponent1 = () => {
      const { isConnected } = useSocket();
      return <div data-testid="child1">{isConnected ? 'Connected' : 'Disconnected'}</div>;
    };

    const ChildComponent2 = () => {
      const { socket } = useSocket();
      return <div data-testid="child2">{socket?.id || 'No socket'}</div>;
    };

    renderWithProvider(
      <>
        <ChildComponent1 />
        <ChildComponent2 />
      </>
    );

    expect(screen.getByTestId('child1')).toHaveTextContent('Connected');
    expect(screen.getByTestId('child2')).toHaveTextContent('socket-123');
  });

  it('should handle environment variable for server URL', () => {
    // Mock environment variable
    const originalEnv = import.meta.env.VITE_SERVER_URL;
    import.meta.env.VITE_SERVER_URL = 'http://env-server:3000';

    renderWithProvider(<TestComponent />);

    expect(mockUseSocketHook).toHaveBeenCalledWith('http://env-server:3000');

    // Restore original environment
    import.meta.env.VITE_SERVER_URL = originalEnv;
  });
});