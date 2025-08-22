import { describe, it, expect } from 'vitest';

describe('Test Setup', () => {
  it('should have jest-dom matchers available', () => {
    const element = document.createElement('div');
    element.textContent = 'Hello World';
    document.body.appendChild(element);
    
    expect(element).toBeInTheDocument();
    expect(element).toHaveTextContent('Hello World');
  });

  it('should have mocked localStorage', () => {
    localStorage.setItem('test', 'value');
    expect(localStorage.setItem).toHaveBeenCalledWith('test', 'value');
  });

  it('should have mocked fetch', () => {
    expect(typeof fetch).toBe('function');
  });

  it('should have mocked socket.io', () => {
    expect(typeof io).toBe('function');
    const socket = io();
    expect(socket).toHaveProperty('on');
    expect(socket).toHaveProperty('emit');
  });
});