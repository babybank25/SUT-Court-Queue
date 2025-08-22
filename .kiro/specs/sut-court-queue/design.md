# Design Document - SUT Court Queue System

## Overview

ระบบ SUT Court Queue เป็น web application แบบ real-time ที่ใช้สำหรับจัดการคิวการแข่งขันบาสเกตบอล ระบบจะใช้ React สำหรับ frontend, Node.js/Express สำหรับ backend, และ WebSocket สำหรับการอัปเดตแบบ real-time

## Architecture

### System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │◄──►│  Express API    │◄──►│   Database      │
│   (Frontend)    │    │   (Backend)     │    │   (SQLite)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         └───────────────────────┘
              WebSocket
```

### Technology Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: SQLite (สำหรับ development), PostgreSQL (สำหรับ production)
- **Real-time**: Socket.IO
- **State Management**: React Context API
- **Authentication**: JWT tokens

## Components and Interfaces

### Frontend Components

#### 1. Layout Components
- `App.tsx` - Main application wrapper
- `Navigation.tsx` - Tab navigation (Public Queue, Match View, Admin)
- `Layout.tsx` - Common layout wrapper

#### 2. Public Queue Components
- `PublicQueue.tsx` - Main queue display page
- `QueueList.tsx` - Display current queue with teams
- `JoinQueueModal.tsx` - Modal form for joining queue
- `CourtStatus.tsx` - Display court status and time

#### 3. Match View Components
- `MatchView.tsx` - Live match display page
- `Scoreboard.tsx` - Real-time score display
- `MatchInfo.tsx` - Match details and statistics
- `ConfirmationModal.tsx` - Match result confirmation
- `RecentEvents.tsx` - Match event timeline

#### 4. Admin Components
- `AdminDashboard.tsx` - Main admin interface
- `ActiveMatches.tsx` - Manage active matches
- `TeamsManagement.tsx` - Team CRUD operations
- `QueueManager.tsx` - Queue position management
- `QuickStats.tsx` - Statistics overview

### Backend API Endpoints

#### Public Endpoints
```
GET    /api/queue              - Get current queue
POST   /api/queue/join         - Join queue
GET    /api/match/current      - Get current match
GET    /api/court/status       - Get court status
```

#### Team Endpoints
```
POST   /api/match/confirm      - Confirm match result
GET    /api/team/:id/stats     - Get team statistics
```

#### Admin Endpoints
```
GET    /api/admin/dashboard    - Get dashboard data
POST   /api/admin/match/start  - Start new match
PUT    /api/admin/match/:id    - Update match
DELETE /api/admin/team/:id     - Remove team
POST   /api/admin/match/resolve - Force resolve match
```

### WebSocket Events
```
// Client to Server
'join-queue'        - Team joins queue
'confirm-result'    - Confirm match result
'admin-action'      - Admin performs action

// Server to Client
'queue-updated'     - Queue list changed
'match-updated'     - Match score/status changed
'court-status'      - Court status changed
'notification'      - System notifications
```

## Data Models

### Team Model
```typescript
interface Team {
  id: string;
  name: string;
  members: number;
  contactInfo?: string;
  status: 'waiting' | 'playing' | 'cooldown';
  wins: number;
  lastSeen: Date;
  position?: number;
}
```

### Match Model
```typescript
interface Match {
  id: string;
  team1: Team;
  team2: Team;
  score1: number;
  score2: number;
  status: 'active' | 'confirming' | 'completed';
  startTime: Date;
  endTime?: Date;
  targetScore: number;
  matchType: 'champion-return' | 'regular';
  confirmed: {
    team1: boolean;
    team2: boolean;
  };
}
```

### Court Model
```typescript
interface CourtStatus {
  isOpen: boolean;
  currentTime: Date;
  timezone: string;
  mode: 'champion-return' | 'regular';
  cooldownEnd?: Date;
  rateLimit: {
    current: number;
    max: number;
    window: string;
  };
}
```

### Queue Model
```typescript
interface QueueState {
  teams: Team[];
  maxSize: number;
  currentMatch?: Match;
  lastUpdated: Date;
}
```

## Error Handling

### Frontend Error Handling
- Global error boundary for React components
- Toast notifications for user feedback
- Retry mechanisms for failed API calls
- Offline state detection and handling

### Backend Error Handling
- Centralized error middleware
- Structured error responses
- Rate limiting protection
- Input validation with detailed messages

### Error Response Format
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: Date;
}
```

## Testing Strategy

### Unit Testing
- **Frontend**: Jest + React Testing Library
  - Component rendering tests
  - User interaction tests
  - Hook functionality tests
- **Backend**: Jest + Supertest
  - API endpoint tests
  - Business logic tests
  - Database operation tests

### Integration Testing
- API integration tests with test database
- WebSocket connection and event tests
- End-to-end user workflows

### E2E Testing
- Playwright for critical user journeys:
  - Team joining queue flow
  - Match confirmation process
  - Admin management operations

### Performance Testing
- Load testing for concurrent users
- WebSocket connection stress tests
- Database query optimization validation

## Security Considerations

### Authentication & Authorization
- JWT tokens for admin authentication
- Rate limiting on all endpoints
- Input sanitization and validation
- CORS configuration for allowed origins

### Data Protection
- No sensitive personal data storage
- Contact info encryption if stored
- Audit logs for admin actions
- Session timeout for admin users

### Real-time Security
- WebSocket connection validation
- Event payload verification
- Rate limiting on socket events
- Connection cleanup on disconnect

## Deployment Architecture

### Development Environment
- Local SQLite database
- Hot reload for both frontend and backend
- Mock WebSocket connections for testing

### Production Environment
- PostgreSQL database with connection pooling
- Redis for session storage and caching
- Load balancer for multiple server instances
- WebSocket sticky sessions configuration

### Monitoring & Logging
- Application performance monitoring
- Error tracking and alerting
- WebSocket connection metrics
- Database query performance logs