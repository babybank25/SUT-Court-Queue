import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { SocketProvider } from './contexts/SocketContext'
import { AppProvider } from './contexts/AppContext'
import { AuthProvider } from './contexts/AuthContext'
import { RealtimeDataProvider } from './contexts/RealtimeDataContext'
import { ToastProvider } from './contexts/ToastContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'
import { Navigation } from './components/Navigation'
import { PublicQueue } from './pages/PublicQueue'
import { MatchView } from './pages/MatchView'
import { AdminDashboard } from './pages/AdminDashboard'

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ToastProvider>
          <AuthProvider>
            <SocketProvider>
              <RealtimeDataProvider>
                <Router>
                  <ErrorBoundary>
                    <Layout>
                      <Navigation />
                      <Routes>
                        <Route path="/" element={<PublicQueue />} />
                        <Route path="/match" element={<MatchView />} />
                        <Route path="/admin" element={<AdminDashboard />} />
                      </Routes>
                    </Layout>
                  </ErrorBoundary>
                </Router>
              </RealtimeDataProvider>
            </SocketProvider>
          </AuthProvider>
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  )
}

export default App