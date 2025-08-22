import React from 'react'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Navigation } from '../Navigation'
import { Layout } from '../Layout'
import { AppProvider } from '../../contexts/AppContext'

// Mock the useApp hook
jest.mock('../../contexts/AppContext', () => ({
  ...jest.requireActual('../../contexts/AppContext'),
  useApp: () => ({
    state: {
      courtStatus: {
        currentTime: new Date().toISOString(),
        timezone: 'Asia/Bangkok'
      },
      error: null,
      isLoading: false
    }
  })
}))

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AppProvider>
        {component}
      </AppProvider>
    </BrowserRouter>
  )
}

describe('Responsive Design', () => {
  beforeEach(() => {
    // Reset window size
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    })
  })

  describe('Navigation Component', () => {
    it('should render navigation with responsive classes', () => {
      renderWithProviders(<Navigation />)
      
      // Check if navigation items exist
      expect(screen.getByText('Public Queue')).toBeInTheDocument()
      expect(screen.getByText('Match View')).toBeInTheDocument()
      expect(screen.getByText('Admin')).toBeInTheDocument()
    })

    it('should have mobile-friendly navigation structure', () => {
      renderWithProviders(<Navigation />)
      
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveClass('mb-4', 'sm:mb-6')
    })
  })

  describe('Layout Component', () => {
    it('should render layout with responsive padding', () => {
      renderWithProviders(
        <Layout>
          <div>Test Content</div>
        </Layout>
      )
      
      expect(screen.getByText('SUT Court Queue')).toBeInTheDocument()
      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })

    it('should have responsive container classes', () => {
      renderWithProviders(
        <Layout>
          <div>Test Content</div>
        </Layout>
      )
      
      // Check if the main container has responsive classes
      const container = screen.getByText('Test Content').closest('main')
      expect(container).toHaveClass('p-3', 'sm:p-6')
    })
  })

  describe('Mobile-specific features', () => {
    it('should have touch-friendly button sizes', () => {
      renderWithProviders(<Navigation />)
      
      const navLinks = screen.getAllByRole('link')
      navLinks.forEach(link => {
        // Check if links have appropriate padding for touch targets
        expect(link).toHaveClass('py-2')
      })
    })

    it('should handle responsive text sizes', () => {
      renderWithProviders(
        <Layout>
          <div>Test Content</div>
        </Layout>
      )
      
      const heading = screen.getByText('SUT Court Queue')
      expect(heading).toHaveClass('text-2xl', 'sm:text-3xl')
    })
  })
})