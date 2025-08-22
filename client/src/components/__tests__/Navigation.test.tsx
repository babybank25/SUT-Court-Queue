import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Navigation } from '../Navigation';

const NavigationWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('Navigation', () => {
  it('renders all navigation items', () => {
    render(
      <NavigationWrapper>
        <Navigation />
      </NavigationWrapper>
    );

    expect(screen.getByText('Public Queue')).toBeInTheDocument();
    expect(screen.getByText('Match View')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('renders navigation icons', () => {
    render(
      <NavigationWrapper>
        <Navigation />
      </NavigationWrapper>
    );

    expect(screen.getByText('📋')).toBeInTheDocument();
    expect(screen.getByText('🏀')).toBeInTheDocument();
    expect(screen.getByText('⚙️')).toBeInTheDocument();
  });

  it('renders short labels on mobile', () => {
    render(
      <NavigationWrapper>
        <Navigation />
      </NavigationWrapper>
    );

    expect(screen.getByText('Queue')).toBeInTheDocument();
    expect(screen.getByText('Match')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('has correct navigation links', () => {
    render(
      <NavigationWrapper>
        <Navigation />
      </NavigationWrapper>
    );

    const queueLink = screen.getByRole('link', { name: /public queue/i });
    const matchLink = screen.getByRole('link', { name: /match view/i });
    const adminLink = screen.getByRole('link', { name: /admin/i });

    expect(queueLink).toHaveAttribute('href', '/');
    expect(matchLink).toHaveAttribute('href', '/match');
    expect(adminLink).toHaveAttribute('href', '/admin');
  });
});