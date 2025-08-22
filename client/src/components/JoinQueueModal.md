# JoinQueueModal Component

## Overview

The `JoinQueueModal` component provides a user interface for teams to join the basketball court queue. It includes form validation, API integration, and comprehensive error handling with user feedback.

## Features

### Form Fields
- **Team Name** (Required): 1-50 characters, must be unique in current queue
- **Number of Players** (Required): 1-10 players via dropdown selection
- **Contact Info** (Optional): Up to 100 characters for coordination

### Validation
- Client-side validation with real-time feedback
- Server-side validation integration
- Duplicate team name detection
- Input sanitization before submission

### User Feedback
- Toast notifications for success/error states
- Loading states during submission
- Success confirmation with queue position and estimated wait time
- Comprehensive error messages for different failure scenarios

### API Integration
- RESTful API calls to `/api/queue/join`
- Proper error handling for network issues
- Integration with real-time queue updates via WebSocket

## Usage

```tsx
import { JoinQueueModal } from '../components';

const MyComponent = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSuccess = (teamData) => {
    console.log('Team joined:', teamData);
  };

  return (
    <JoinQueueModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      onSuccess={handleSuccess}
    />
  );
};
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | Controls modal visibility |
| `onClose` | `() => void` | Yes | Called when modal should close |
| `onSuccess` | `(teamData) => void` | No | Called when team successfully joins queue |

## Dependencies

- `useSocketContext` - For WebSocket connection status
- `useRealtimeQueue` - For current queue state and validation
- `useToast` - For user feedback notifications
- Validation utilities from `../utils/validateJoinQueue`

## Error Handling

The component handles various error scenarios:

1. **Validation Errors**: Client-side validation with immediate feedback
2. **Network Errors**: Connection issues with retry suggestions
3. **API Errors**: Server-side validation and business logic errors
4. **Queue Full**: Special handling when queue reaches capacity
5. **Duplicate Names**: Prevention of duplicate team names

## Accessibility

- Proper form labels and ARIA attributes
- Keyboard navigation support
- Focus management for modal interactions
- Screen reader friendly error messages

## Testing

Comprehensive test coverage includes:
- Form validation scenarios
- API integration testing
- Error handling verification
- User interaction testing
- Accessibility compliance

See `__tests__/JoinQueueModal.test.tsx` for detailed test cases.

## Requirements Fulfilled

This component fulfills the following requirements from the SUT Court Queue specification:

- **Requirement 1.2**: Form with team name, number of players, and contact info fields
- **Requirement 1.3**: Form submission with API integration and validation  
- **Requirement 1.4**: Error handling and user feedback with appropriate messages

## Implementation Notes

- Uses controlled components for form state management
- Integrates with existing toast notification system
- Follows established patterns from other components in the codebase
- Maintains consistency with server-side validation rules
- Provides real-time feedback for better user experience