import { useEffect, useCallback } from 'react'
import { useSocketContext } from '../contexts/SocketContext'
import { useApp } from '../contexts/AppContext'

interface UseSocketConnectionOptions {
  autoJoinRooms?: string[]
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: any) => void
}

export const useSocketConnection = (options: UseSocketConnectionOptions = {}) => {
  const {
    autoJoinRooms = ['public'],
    onConnect,
    onDisconnect,
    onError
  } = options

  const { 
    socket, 
    isConnected, 
    connectionError, 
    emit, 
    on, 
    off, 
    joinRoom, 
    leaveRoom,
    reconnect 
  } = useSocketContext()
  
  const { actions } = useApp()

  // Handle connection events
  useEffect(() => {
    if (!socket) return

    const handleConnect = () => {
      console.log('🔌 Socket connected successfully')
      
      // Auto-join specified rooms
      autoJoinRooms.forEach(room => {
        joinRoom(room)
      })
      
      // Call custom connect handler
      if (onConnect) {
        onConnect()
      }
      
      // Clear any connection errors
      actions.clearError()
    }

    const handleDisconnect = (reason: string) => {
      console.log('🔌 Socket disconnected:', reason)
      
      // Call custom disconnect handler
      if (onDisconnect) {
        onDisconnect()
      }
      
      // Set loading state while reconnecting
      actions.setLoading(true)
    }

    const handleConnectError = (error: any) => {
      console.error('🔌 Socket connection error:', error)
      
      // Call custom error handler
      if (onError) {
        onError(error)
      }
      
      // Set error in app state
      actions.setError(`Connection failed: ${error.message || 'Unknown error'}`)
      actions.setLoading(false)
    }

    // Set up event listeners
    on('connect', handleConnect)
    on('disconnect', handleDisconnect)
    on('connect_error', handleConnectError)

    // Cleanup
    return () => {
      off('connect', handleConnect)
      off('disconnect', handleDisconnect)
      off('connect_error', handleConnectError)
    }
  }, [socket, on, off, joinRoom, autoJoinRooms, onConnect, onDisconnect, onError, actions])

  // Provide convenient methods for common socket operations
  const emitWithErrorHandling = useCallback((event: string, data?: any) => {
    if (!isConnected) {
      actions.setError('Cannot send data: Not connected to server')
      return false
    }
    
    try {
      emit(event, data)
      return true
    } catch (error) {
      console.error(`Failed to emit ${event}:`, error)
      actions.setError(`Failed to send data: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return false
    }
  }, [emit, isConnected, actions])

  const joinRoomWithErrorHandling = useCallback((room: string) => {
    if (!isConnected) {
      actions.setError('Cannot join room: Not connected to server')
      return false
    }
    
    try {
      joinRoom(room)
      return true
    } catch (error) {
      console.error(`Failed to join room ${room}:`, error)
      actions.setError(`Failed to join room: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return false
    }
  }, [joinRoom, isConnected, actions])

  const leaveRoomWithErrorHandling = useCallback((room: string) => {
    if (!isConnected) {
      return false
    }
    
    try {
      leaveRoom(room)
      return true
    } catch (error) {
      console.error(`Failed to leave room ${room}:`, error)
      return false
    }
  }, [leaveRoom, isConnected])

  const reconnectWithFeedback = useCallback(() => {
    actions.setLoading(true)
    actions.clearError()
    
    try {
      reconnect()
    } catch (error) {
      console.error('Failed to reconnect:', error)
      actions.setError(`Failed to reconnect: ${error instanceof Error ? error.message : 'Unknown error'}`)
      actions.setLoading(false)
    }
  }, [reconnect, actions])

  return {
    // Connection status
    isConnected,
    connectionError,
    socket,
    
    // Enhanced methods with error handling
    emit: emitWithErrorHandling,
    joinRoom: joinRoomWithErrorHandling,
    leaveRoom: leaveRoomWithErrorHandling,
    reconnect: reconnectWithFeedback,
    
    // Event handling
    on,
    off,
    
    // Utility methods
    isReady: isConnected && !connectionError
  }
}