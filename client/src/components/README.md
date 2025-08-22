# Queue Display Components

This document describes the queue display components implemented for task 6.1.

## Components

### QueueList

A real-time queue display component that shows current teams and their positions.

**Features:**
- Real-time updates via WebSocket
- Team status indicators (waiting, playing, cooldown)
- Queue statistics (total teams, available slots, waiting count)
- Connection status indicator
- Error handling with user-friendly messages
- Loading states
- Empty state handling

**Props:**
- `className?: string` - Additional CSS classes

**Usage:**
```tsx
import { QueueList } from '../components';

<QueueList className="custom-class" />
```

### CourtStatus

A real-time court status display component showing court availability and current time.

**Features:**
- Real-time court status updates
- Current time display with timezone support
- Game mode indicators (regular/champion-return)
- Cooldown timer for champion return mode
- Active match count
- Connection status indicator
- Error handling
- Loading states

**Props:**
- `className?: string` - Additional CSS classes

**Usage:**
```tsx
import { CourtStatus } from '../components';

<CourtStatus className="custom-class" />
```

## Real-time Updates

Both components use custom hooks for real-time data:

- `QueueList` uses `useRealtimeQueue` hook
- `CourtStatus` uses `useRealtimeCourtStatus` hook

These hooks automatically:
- Connect to WebSocket for real-time updates
- Fetch initial data on mount
- Handle connection states
- Provide error handling
- Offer helper functions for data manipulation

## Styling

Components use Tailwind CSS classes and follow the design system:

- **Colors**: Blue for primary actions, green for success states, yellow for warnings, red for errors
- **Layout**: Responsive grid layouts, proper spacing
- **Typography**: Consistent font weights and sizes
- **Interactive elements**: Hover states and transitions

## Error Handling

Both components include comprehensive error handling:

- Network errors are displayed with user-friendly messages
- Connection status is always visible
- Fallback states for when data is unavailable
- Retry mechanisms where appropriate

## Testing

Test files are available:
- `__tests__/QueueList.test.tsx`
- `__tests__/CourtStatus.test.tsx`

Tests cover:
- Loading states
- Error states
- Data display
- Connection status
- Empty states
- Various team statuses and court modes

## Requirements Satisfied

This implementation satisfies the following requirements:

- **1.1**: Display current queue list with team names and positions ✅
- **5.1**: Display current court status (open/closed) ✅
- **5.2**: Show current time in Asia/Bangkok timezone ✅
- **5.3**: Show total number of teams waiting ✅

The components provide real-time updates and match the design mockup with proper styling and user experience considerations.