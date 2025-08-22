import React, { createContext, useContext, useReducer, ReactNode } from 'react'
import { Team, Match, CourtStatus } from '../types'

// State interface
interface AppState {
  queue: Team[]
  currentMatch: Match | null
  courtStatus: CourtStatus | null
  isLoading: boolean
  error: string | null
  user: {
    isAdmin: boolean
    token: string | null
  }
}

// Action types
type AppAction =
  | { type: 'SET_QUEUE'; payload: Team[] }
  | { type: 'SET_CURRENT_MATCH'; payload: Match | null }
  | { type: 'SET_COURT_STATUS'; payload: CourtStatus }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_USER'; payload: { isAdmin: boolean; token: string | null } }
  | { type: 'CLEAR_ERROR' }

// Initial state
const initialState: AppState = {
  queue: [],
  currentMatch: null,
  courtStatus: null,
  isLoading: false,
  error: null,
  user: {
    isAdmin: false,
    token: localStorage.getItem('adminToken')
  }
}

// Reducer
const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_QUEUE':
      return { ...state, queue: action.payload }
    case 'SET_CURRENT_MATCH':
      return { ...state, currentMatch: action.payload }
    case 'SET_COURT_STATUS':
      return { ...state, courtStatus: action.payload }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'SET_USER':
      if (action.payload.token) {
        localStorage.setItem('adminToken', action.payload.token)
      } else {
        localStorage.removeItem('adminToken')
      }
      return { ...state, user: action.payload }
    case 'CLEAR_ERROR':
      return { ...state, error: null }
    default:
      return state
  }
}

// Context
interface AppContextType {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  actions: {
    setQueue: (queue: Team[]) => void
    setCurrentMatch: (match: Match | null) => void
    setCourtStatus: (status: CourtStatus) => void
    setLoading: (loading: boolean) => void
    setError: (error: string | null) => void
    setUser: (user: { isAdmin: boolean; token: string | null }) => void
    clearError: () => void
  }
}

const AppContext = createContext<AppContextType | undefined>(undefined)

// Provider component
interface AppProviderProps {
  children: ReactNode
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState)

  const actions = {
    setQueue: (queue: Team[]) => dispatch({ type: 'SET_QUEUE', payload: queue }),
    setCurrentMatch: (match: Match | null) => dispatch({ type: 'SET_CURRENT_MATCH', payload: match }),
    setCourtStatus: (status: CourtStatus) => dispatch({ type: 'SET_COURT_STATUS', payload: status }),
    setLoading: (loading: boolean) => dispatch({ type: 'SET_LOADING', payload: loading }),
    setError: (error: string | null) => dispatch({ type: 'SET_ERROR', payload: error }),
    setUser: (user: { isAdmin: boolean; token: string | null }) => dispatch({ type: 'SET_USER', payload: user }),
    clearError: () => dispatch({ type: 'CLEAR_ERROR' })
  }

  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  )
}

// Hook to use the context
export const useApp = (): AppContextType => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}