/**
 * Validation utilities for Join Queue functionality
 * This file contains validation logic that matches the server-side validation
 */

export interface JoinQueueFormData {
  name: string;
  members: number;
  contactInfo?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validates join queue form data according to server-side schema
 */
export const validateJoinQueueForm = (
  data: JoinQueueFormData,
  existingTeamNames: string[] = []
): ValidationResult => {
  const errors: ValidationError[] = [];

  // Team name validation
  if (!data.name || data.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Team name is required' });
  } else if (data.name.trim().length > 50) {
    errors.push({ field: 'name', message: 'Team name must be 50 characters or less' });
  } else if (existingTeamNames.includes(data.name.trim().toLowerCase())) {
    errors.push({ field: 'name', message: 'Team name already exists in queue' });
  }

  // Members validation
  if (!Number.isInteger(data.members) || data.members < 1 || data.members > 10) {
    errors.push({ field: 'members', message: 'Number of players must be between 1 and 10' });
  }

  // Contact info validation (optional)
  if (data.contactInfo && data.contactInfo.length > 100) {
    errors.push({ field: 'contactInfo', message: 'Contact info must be 100 characters or less' });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Sanitizes form data before submission
 */
export const sanitizeJoinQueueData = (data: JoinQueueFormData): JoinQueueFormData => {
  return {
    name: data.name.trim(),
    members: data.members,
    contactInfo: data.contactInfo?.trim() || undefined
  };
};

/**
 * Formats API error messages for user display
 */
export const formatApiError = (error: any): string => {
  if (error?.code === 'TEAM_NAME_EXISTS') {
    return 'Team name already exists. Please choose a different name.';
  } else if (error?.code === 'QUEUE_FULL') {
    return 'Queue is currently full. Please wait for a spot to open up.';
  } else if (error?.code === 'VALIDATION_ERROR') {
    return error?.message || 'Please check your input and try again.';
  } else {
    return error?.message || 'An unexpected error occurred. Please try again.';
  }
};

/**
 * Estimates wait time based on queue position
 */
export const estimateWaitTime = (position: number, averageMatchTime: number = 15): string => {
  const waitMinutes = (position - 1) * averageMatchTime;
  
  if (waitMinutes === 0) {
    return 'Next up!';
  } else if (waitMinutes < 60) {
    return `~${waitMinutes} minutes`;
  } else {
    const hours = Math.floor(waitMinutes / 60);
    const minutes = waitMinutes % 60;
    return `~${hours}h ${minutes}m`;
  }
};