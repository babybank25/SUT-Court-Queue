import React from 'react'
import { NavLink } from 'react-router-dom'

export const Navigation: React.FC = () => {
  const navItems = [
    { path: '/', label: 'Public Queue', shortLabel: 'Queue', icon: '📋' },
    { path: '/match', label: 'Match View', shortLabel: 'Match', icon: '🏀' },
    { path: '/admin', label: 'Admin', shortLabel: 'Admin', icon: '⚙️' }
  ]

  return (
    <nav className="mb-4 sm:mb-6">
      <div className="flex justify-center gap-1 sm:gap-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg font-medium transition-colors duration-200 min-w-0 flex-1 sm:flex-initial ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400'
              }`
            }
          >
            <span className="text-lg sm:text-base">{item.icon}</span>
            <span className="text-xs sm:text-sm sm:hidden truncate">{item.shortLabel}</span>
            <span className="hidden sm:inline text-sm">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}