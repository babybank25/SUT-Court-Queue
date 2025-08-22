import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AdminLoginModal } from './AdminLoginModal';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  fallback 
}) => {
  const { state } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Show loading state while checking authentication
  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // If authenticated, render children
  if (state.isAuthenticated) {
    return <>{children}</>;
  }

  // If not authenticated, show fallback or default login prompt
  const defaultFallback = (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">🔒</div>
      <h3 className="text-xl font-semibold text-gray-800 mb-2">Admin Access Required</h3>
      <p className="text-gray-600 mb-6">Please log in with admin credentials to access this page</p>
      
      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 max-w-md mx-auto">
          <p className="text-sm text-red-800">{state.error}</p>
        </div>
      )}
      
      <button 
        onClick={() => setShowLoginModal(true)}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Admin Login
      </button>
      
      <AdminLoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
      />
    </div>
  );

  return <>{fallback || defaultFallback}</>;
};