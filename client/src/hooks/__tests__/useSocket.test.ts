import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSocket } from '../useSocket';
import { io } from 'socket.io-client';

// Mock socket.io-client
vi.mock('socket.io-client');

const mockIo = vi.mocked(io);
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
  id: 'socket-123',
};

describe('useSocket', () => {
  beforeEach(() => {
    mockIo.mockReturnValue(mockSocket as any);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize socket connection', () => {
    renderHook(() => useSocket('http://localhost:3001'));

    expect(mockIo).toHaveBeenCalledWith('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: false,
    });
  });

  it('should return socket instance and connection status', () => {
    mockSocket.connected = true;
    const { result } = renderHook(() => useSocket('http://localhost:3001'));

    expect(result.current.socket).toBe(mockSocket);
    expect(result.current.isConnected).toBe(true);
  });

  it('should handle connection events', () => {
    const { result } = renderHook(() => useSocket('http://localhost:3001'));

    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));

    // Simulate connection
    const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
    act(() => {
      connectHandler?.();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('should handle disconnection events', () => {
    mockSocket.connected = true;
    const { result } = renderHook(() => useSocket('http://localhost:3001'));

    // Simulate disconnection
    const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')?.[1];
    act(() => {
      mockSocket.connected = false;
      disconnectHandler?.('transport close');
    });

    expect(result.current.isConnected).toBe(false);
  });

  it('should handle connection errors', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHook(() => useSocket('http://localhost:3001'));

    // Simulate connection error
    const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')?.[1];
    const error = new Error('Connection failed');
    
    act(() => {
      errorHandler?.(error);
    });

    expect(consoleSpy).toHaveBeenCalledWith('Socket connection error:', error);
    consoleSpy.mockRestore();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useSocket('http://localhost:3001'));

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('connect');
    expect(mockSocket.off).toHaveBeenCalledWith('disconnect');
    expect(mockSocket.off).toHaveBeenCalledWith('connect_error');
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('should not create multiple connections for same URL', () => {
    const { rerender } = renderHook(() => useSocket('http://localhost:3001'));
    
    rerender();
    rerender();

    expect(mockIo).toHaveBeenCalledTimes(1);
  });

  it('should create new connection for different URL', () => {
    const { rerender } = renderHook(
      ({ url }) => useSocket(url),
      { initialProps: { url: 'http://localhost:3001' } }
    );

    rerender({ url: 'http://localhost:3002' });

    expect(mockIo).toHaveBeenCalledTimes(2);
    expect(mockIo).toHaveBeenNthCalledWith(1, 'http://localhost:3001', expect.any(Object));
    expect(mockIo).toHaveBeenNthCalledWith(2, 'http://localhost:3002', expect.any(Object));
  });

  it('should handle reconnection attempts', () => {
    const { result } = renderHook(() => useSocket('http://localhost:3001'));

    // Simulate disconnect
    act(() => {
      mockSocket.connected = false;
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')?.[1];
      disconnectHandler?.('transport close');
    });

    expect(result.current.isConnected).toBe(false);

    // Simulate reconnect
    act(() => {
      mockSocket.connected = true;
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      connectHandler?.();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('should provide emit function', () => {
    const { result } = renderHook(() => useSocket('http://localhost:3001'));

    act(() => {
      result.current.emit('test-event', { data: 'test' });
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
  });

  it('should provide on function for event listeners', () => {
    const { result } = renderHook(() => useSocket('http://localhost:3001'));
    const callback = vi.fn();

    act(() => {
      result.current.on('test-event', callback);
    });

    expect(mockSocket.on).toHaveBeenCalledWith('test-event', callback);
  });

  it('should provide off function for removing event listeners', () => {
    const { result } = renderHook(() => useSocket('http://localhost:3001'));
    const callback = vi.fn();

    act(() => {
      result.current.off('test-event', callback);
    });

    expect(mockSocket.off).toHaveBeenCalledWith('test-event', callback);
  });

  it('should handle socket options', () => {
    const options = {
      transports: ['websocket'] as const,
      timeout: 10000,
      forceNew: true,
    };

    renderHook(() => useSocket('http://localhost:3001', options));

    expect(mockIo).toHaveBeenCalledWith('http://localhost:3001', options);
  });

  it('should return connection state changes', () => {
    const { result } = renderHook(() => useSocket('http://localhost:3001'));

    expect(result.current.isConnected).toBe(false);

    // Simulate connection
    act(() => {
      mockSocket.connected = true;
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      connectHandler?.();
    });

    expect(result.current.isConnected).toBe(true);

    // Simulate disconnection
    act(() => {
      mockSocket.connected = false;
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')?.[1];
      disconnectHandler?.('transport close');
    });

    expect(result.current.isConnected).toBe(false);
  });
});