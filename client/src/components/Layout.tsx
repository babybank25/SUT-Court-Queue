import React from 'react'
import { ConnectionStatus } from './ConnectionStatus'
import { useApp } from '../contexts/AppContext'

interface LayoutProps {
  children: React.ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { state } = useApp()

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-6xl">
        <header className="mb-4 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 space-y-4 sm:space-y-0">
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1 sm:mb-2">
                SUT Court Queue
              </h1>
              <p className="text-sm sm:text-base text-gray-600">
                Basketball court queue management system
              </p>
            </div>
            <div className="flex flex-col items-center sm:items-end gap-2">
              <ConnectionStatus />
              {state.courtStatus && (
                <div className="text-xs text-gray-500">
                  {new Date(state.courtStatus.currentTime).toLocaleTimeString('th-TH', {
                    timeZone: state.courtStatus.timezone
                  })}
                </div>
              )}
            </div>
          </div>
          
          {/* Error Display */}
          {state.error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <div className="flex justify-between items-center">
                <span>{state.error}</span>
                <button
                  onClick={() => state.error && window.location.reload()}
                  className="text-red-500 hover:text-red-700 text-sm underline"
                >
                  Reload
                </button>
              </div>
            </div>
          )}
          
          {/* Loading Indicator */}
          {state.isLoading && (
            <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
                <span>Connecting to server...</span>
              </div>
            </div>
          )}
        </header>
        
        <main className="bg-white rounded-lg shadow-lg p-3 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}