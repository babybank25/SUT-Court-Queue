import React from 'react'
import { useRealtimeData } from '../contexts/RealtimeDataContext'
import { useSocketContext } from '../contexts/SocketContext'

export const ConnectionStatus: React.FC = () => {
  const { isConnected, connectionError, reconnectAttempts } = useRealtimeData()
  const { reconnect } = useSocketContext()

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 text-green-600 text-sm">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span>Connected</span>
      </div>
    )
  }

  if (connectionError) {
    return (
      <div className="flex items-center gap-2 text-red-600 text-sm">
        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        <span>Connection Error</span>
        {reconnectAttempts > 0 && (
          <span className="text-xs text-gray-500">
            (Attempt {reconnectAttempts})
          </span>
        )}
        <button
          onClick={reconnect}
          className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-yellow-600 text-sm">
      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
      <span>Connecting...</span>
    </div>
  )
}