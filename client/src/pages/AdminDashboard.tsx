import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { QuickStats, ActiveMatches, TeamsManagement, QueueManager } from '../components/admin'

const AdminDashboardContent: React.FC = () => {
  const { state: authState, logout } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-3 sm:py-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1 sm:mb-2">Admin Dashboard</h2>
          <p className="text-sm sm:text-base text-gray-600">Manage teams, matches, and court operations</p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mt-2 text-xs sm:text-sm text-gray-500 space-y-1 sm:space-y-0">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span>System Online</span>
            </div>
            <div>
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <div className="text-center sm:text-right">
            <div className="text-sm text-gray-600">
              Welcome, <span className="font-medium">{authState.admin?.username}</span>
            </div>
            <div className="text-xs text-gray-500">
              Admin Session Active
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center justify-center space-x-2 bg-gray-600 text-white px-3 sm:px-4 py-2 rounded-lg font-medium hover:bg-gray-700 active:bg-gray-800 transition-colors text-sm sm:text-base min-h-[44px] touch-manipulation"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Quick Stats - Takes 1 column */}
        <div className="lg:col-span-1">
          <QuickStats key={`stats-${refreshKey}`} />
        </div>

        {/* Active Matches - Takes 3 columns */}
        <div className="lg:col-span-3">
          <ActiveMatches 
            key={`matches-${refreshKey}`}
            onRefresh={handleRefresh} 
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <button 
            onClick={() => {
              // Scroll to queue management section
              document.getElementById('queue-management')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2 bg-green-600 text-white py-2 sm:py-3 px-2 sm:px-4 rounded-lg font-medium hover:bg-green-700 active:bg-green-800 transition-colors text-xs sm:text-sm min-h-[44px] touch-manipulation"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Start Match</span>
          </button>
          <button 
            onClick={() => {
              // Scroll to teams management section
              document.getElementById('teams-management')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2 bg-blue-600 text-white py-2 sm:py-3 px-2 sm:px-4 rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors text-xs sm:text-sm min-h-[44px] touch-manipulation"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="hidden sm:inline">Manage Teams</span>
            <span className="sm:hidden">Teams</span>
          </button>
          <button 
            onClick={() => {
              // Scroll to queue management section
              document.getElementById('queue-management')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2 bg-orange-600 text-white py-2 sm:py-3 px-2 sm:px-4 rounded-lg font-medium hover:bg-orange-700 active:bg-orange-800 transition-colors text-xs sm:text-sm min-h-[44px] touch-manipulation"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="hidden sm:inline">Manage Queue</span>
            <span className="sm:hidden">Queue</span>
          </button>
          <button 
            onClick={handleRefresh}
            className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2 bg-gray-600 text-white py-2 sm:py-3 px-2 sm:px-4 rounded-lg font-medium hover:bg-gray-700 active:bg-gray-800 transition-colors text-xs sm:text-sm min-h-[44px] touch-manipulation"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Refresh All</span>
            <span className="sm:hidden">Refresh</span>
          </button>
        </div>
      </div>

      {/* Queue Management */}
      <div id="queue-management">
        <QueueManager key={`queue-${refreshKey}`} />
      </div>

      {/* Teams Management */}
      <div id="teams-management">
        <TeamsManagement key={`teams-${refreshKey}`} />
        </div>
      </div>
    </div>
  )
}

export const AdminDashboard: React.FC = () => {
  return (
    <ProtectedRoute>
      <AdminDashboardContent />
    </ProtectedRoute>
  )
}