import React, { createContext, useContext, useEffect, ReactNode } from 'react'
import { useSocketContext } from './SocketContext'
import { useApp } from './AppContext'
import { useSocketErrorHandler } from '../hooks/useSocketErrorHandler'
import { QueueUpdateData, MatchUpdateData, CourtStatusData, NotificationData } from '../types'

interface RealtimeDataContextType {
  isConnected: boolean
  connectionError: string | null
  reconnectAttempts: number
  lastConnected?: Date
}

const RealtimeDataContext = createContext<RealtimeDataContextType | undefined>(undefined)

interface RealtimeDataProviderProps {
  children: ReactNode
}

export const RealtimeDataProvider: React.FC<RealtimeDataProviderProps> = ({ children }) => {
  const { 
    connectionStatus, 
    onQueueUpdate, 
    onMatchUpdate, 
    onCourtStatus, 
    onNotification 
  } = useSocketContext()
  
  const { actions } = useApp()

  // Set up error handling
  useSocketErrorHandler({
    showToasts: true,
    onError: (error) => {
      actions.setError(`Socket Error: ${error.message}`)
    },
    onNotification: (notification) => {
      // Handle different notification types
      if (notification.type === 'error') {
        actions.setError(notification.message)
      }
      // You can extend this to handle other notification types
    }
  })

  // Handle queue updates
  useEffect(() => {
    const handleQueueUpdate = (data: QueueUpdateData) => {
      console.log('📋 Queue updated:', data)
      
      // Update queue if teams data is provided
      if (data.teams) {
        actions.setQueue(data.teams)
      }
      
      // Update current match if provided
      if (data.currentMatch !== undefined) {
        actions.setCurrentMatch(data.currentMatch)
      }
      
      // Handle completed match
      if (data.completedMatch) {
        console.log('🏆 Match completed:', data.completedMatch)
        // You can add additional logic here for completed matches
      }
      
      // Clear any existing errors on successful update
      actions.clearError()
    }

    onQueueUpdate(handleQueueUpdate)
    
    // Cleanup is handled by the socket context
  }, [onQueueUpdate, actions])

  // Handle match updates
  useEffect(() => {
    const handleMatchUpdate = (data: MatchUpdateData) => {
      console.log('🏀 Match updated:', data)
      
      // Update current match
      actions.setCurrentMatch(data.match)
      
      // Handle specific match events
      switch (data.event) {
        case 'score_updated':
          console.log('📊 Score updated:', data.score)
          break
        case 'match_ended':
          console.log('🏁 Match ended')
          break
        case 'match_completed':
          console.log('✅ Match completed')
          break
        case 'confirmation_received':
          console.log('✋ Confirmation received:', data.waitingFor)
          break
        case 'match_timeout_resolved':
          console.log('⏰ Match timeout resolved')
          break
        case 'match_started':
          console.log('🚀 Match started:', data.teams)
          break
        case 'match_force_resolved':
          console.log('⚡ Match force resolved by:', data.resolvedBy)
          break
        default:
          console.log('🔄 Match updated by:', data.updatedBy)
      }
      
      // Clear any existing errors on successful update
      actions.clearError()
    }

    onMatchUpdate(handleMatchUpdate)
    
    // Cleanup is handled by the socket context
  }, [onMatchUpdate, actions])

  // Handle court status updates
  useEffect(() => {
    const handleCourtStatus = (data: CourtStatusData) => {
      console.log('🏟️ Court status updated:', data)
      
      // Convert the data to match our CourtStatus interface
      const courtStatus = {
        isOpen: data.isOpen,
        currentTime: new Date(data.currentTime),
        timezone: data.timezone,
        mode: data.mode,
        cooldownEnd: data.cooldownEnd ? new Date(data.cooldownEnd) : undefined,
        rateLimit: {
          current: 0, // This would need to be provided by the server
          max: 100,   // This would need to be provided by the server
          window: '1m' // This would need to be provided by the server
        }
      }
      
      actions.setCourtStatus(courtStatus)
      
      // Clear any existing errors on successful update
      actions.clearError()
    }

    onCourtStatus(handleCourtStatus)
    
    // Cleanup is handled by the socket context
  }, [onCourtStatus, actions])

  // Handle notifications
  useEffect(() => {
    const handleNotification = (data: NotificationData) => {
      console.log('🔔 Notification received:', data)
      
      // Handle different notification types
      switch (data.type) {
        case 'error':
          actions.setError(data.message)
          break
        case 'warning':
          console.warn('⚠️ Warning:', data.message)
          break
        case 'success':
          console.log('✅ Success:', data.message)
          // Clear any existing errors on success
          actions.clearError()
          break
        case 'info':
          console.log('ℹ️ Info:', data.message)
          break
        default:
          console.log('📢 Notification:', data.message)
      }
    }

    onNotification(handleNotification)
    
    // Cleanup is handled by the socket context
  }, [onNotification, actions])

  // Monitor connection status and update loading state
  useEffect(() => {
    if (connectionStatus.isConnected) {
      actions.setLoading(false)
      actions.clearError()
    } else if (connectionStatus.connectionError) {
      actions.setLoading(false)
      actions.setError(`Connection Error: ${connectionStatus.connectionError}`)
    } else {
      actions.setLoading(true)
    }
  }, [connectionStatus, actions])

  const contextValue: RealtimeDataContextType = {
    isConnected: connectionStatus.isConnected,
    connectionError: connectionStatus.connectionError,
    reconnectAttempts: connectionStatus.reconnectAttempts,
    lastConnected: connectionStatus.lastConnected
  }

  return (
    <RealtimeDataContext.Provider value={contextValue}>
      {children}
    </RealtimeDataContext.Provider>
  )
}

export const useRealtimeData = (): RealtimeDataContextType => {
  const context = useContext(RealtimeDataContext)
  if (context === undefined) {
    throw new Error('useRealtimeData must be used within a RealtimeDataProvider')
  }
  return context
}