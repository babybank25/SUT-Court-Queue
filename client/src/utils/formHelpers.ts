/**
 * Form validation and helper utilities
 * Provides common form validation patterns and helper functions
 */

import { InputSanitizer } from './formValidation';

/**
 * Common validation patterns
 */
export const ValidationPatterns = {
  // Thai and English alphanumeric with spaces
  teamName: /^[a-zA-Z0-9\s\u0E00-\u0E7F]+$/,
  
  // Username (alphanumeric, underscore, dot, dash)
  username: /^[a-zA-Z0-9_.-]+$/,
  
  // Email pattern
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  
  // Phone number (digits, +, -, (, ), spaces)
  phone: /^[\d+()-\s]{10,20}$/,
  
  // URL pattern
  url: /^https?:\/\/.+/,
  
  // Strong password (at least 8 chars, 1 upper, 1 lower, 1 number)
  strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  
  // Numbers only
  numbersOnly: /^\d+$/,
  
  // Decimal numbers
  decimal: /^\d+(\.\d{1,2})?$/
};

/**
 * Form field validation functions
 */
export const FieldValidators = {
  /**
   * Validate required field
   */
  required: (value: any, fieldName: string = 'Field'): string | null => {
    if (value === null || value === undefined || value === '') {
      return `${fieldName} is required`;
    }
    return null;
  },

  /**
   * Validate string length
   */
  length: (value: string, min: number, max: number, fieldName: string = 'Field'): string | null => {
    if (typeof value !== 'string') return null;
    
    if (value.length < min) {
      return `${fieldName} must be at least ${min} characters`;
    }
    if (value.length > max) {
      return `${fieldName} must be no more than ${max} characters`;
    }
    return null;
  },

  /**
   * Validate number range
   */
  range: (value: number, min: number, max: number, fieldName: string = 'Field'): string | null => {
    if (typeof value !== 'number' || isNaN(value)) {
      return `${fieldName} must be a valid number`;
    }
    
    if (value < min) {
      return `${fieldName} must be at least ${min}`;
    }
    if (value > max) {
      return `${fieldName} must be no more than ${max}`;
    }
    return null;
  },

  /**
   * Validate pattern match
   */
  pattern: (value: string, pattern: RegExp, message: string): string | null => {
    if (typeof value !== 'string') return null;
    if (!pattern.test(value)) {
      return message;
    }
    return null;
  },

  /**
   * Validate email format
   */
  email: (value: string): string | null => {
    if (!value) return null;
    return FieldValidators.pattern(value, ValidationPatterns.email, 'Invalid email format');
  },

  /**
   * Validate phone number format
   */
  phone: (value: string): string | null => {
    if (!value) return null;
    return FieldValidators.pattern(value, ValidationPatterns.phone, 'Invalid phone number format');
  },

  /**
   * Validate URL format
   */
  url: (value: string): string | null => {
    if (!value) return null;
    return FieldValidators.pattern(value, ValidationPatterns.url, 'URL must start with http:// or https://');
  },

  /**
   * Validate team name
   */
  teamName: (value: string): string | null => {
    if (!value) return null;
    
    const lengthError = FieldValidators.length(value, 1, 50, 'Team name');
    if (lengthError) return lengthError;
    
    return FieldValidators.pattern(
      value, 
      ValidationPatterns.teamName, 
      'Team name can only contain letters, numbers, and spaces'
    );
  },

  /**
   * Validate username
   */
  username: (value: string): string | null => {
    if (!value) return null;
    
    const lengthError = FieldValidators.length(value, 3, 50, 'Username');
    if (lengthError) return lengthError;
    
    return FieldValidators.pattern(
      value, 
      ValidationPatterns.username, 
      'Username can only contain letters, numbers, underscore, dot, and dash'
    );
  },

  /**
   * Validate password strength
   */
  password: (value: string, requireStrong: boolean = false): string | null => {
    if (!value) return null;
    
    if (value.length < 6) {
      return 'Password must be at least 6 characters';
    }
    
    if (requireStrong && !ValidationPatterns.strongPassword.test(value)) {
      return 'Password must contain at least 8 characters, 1 uppercase, 1 lowercase, and 1 number';
    }
    
    return null;
  },

  /**
   * Validate password confirmation
   */
  passwordConfirm: (password: string, confirmPassword: string): string | null => {
    if (!confirmPassword) return null;
    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  }
};

/**
 * Form sanitization helpers
 */
export const FormSanitizers = {
  /**
   * Sanitize form data based on field types
   */
  sanitizeFormData: <T extends Record<string, any>>(data: T, fieldTypes: Record<keyof T, string>): T => {
    const sanitized = { ...data };
    
    Object.entries(fieldTypes).forEach(([field, type]) => {
      const value = sanitized[field as keyof T];
      
      switch (type) {
        case 'teamName':
          sanitized[field as keyof T] = InputSanitizer.sanitizeTeamName(value);
          break;
        case 'contactInfo':
          sanitized[field as keyof T] = InputSanitizer.sanitizeContactInfo(value);
          break;
        case 'username':
          sanitized[field as keyof T] = InputSanitizer.sanitizeUsername(value);
          break;
        case 'email':
          sanitized[field as keyof T] = InputSanitizer.sanitizeEmail(value);
          break;
        case 'phone':
          sanitized[field as keyof T] = InputSanitizer.sanitizePhone(value);
          break;
        case 'url':
          sanitized[field as keyof T] = InputSanitizer.sanitizeUrl(value);
          break;
        case 'number':
          sanitized[field as keyof T] = InputSanitizer.sanitizeNumber(value);
          break;
        case 'string':
        default:
          sanitized[field as keyof T] = InputSanitizer.sanitizeString(value);
          break;
      }
    });
    
    return sanitized;
  }
};

/**
 * Form state helpers
 */
export const FormHelpers = {
  /**
   * Check if form has any errors
   */
  hasErrors: (errors: Record<string, string>): boolean => {
    return Object.values(errors).some(error => error && error.length > 0);
  },

  /**
   * Get first error message
   */
  getFirstError: (errors: Record<string, string>): string | null => {
    const errorEntries = Object.entries(errors);
    const firstError = errorEntries.find(([, error]) => error && error.length > 0);
    return firstError ? firstError[1] : null;
  },

  /**
   * Count number of errors
   */
  getErrorCount: (errors: Record<string, string>): number => {
    return Object.values(errors).filter(error => error && error.length > 0).length;
  },

  /**
   * Check if all required fields are filled
   */
  areRequiredFieldsFilled: <T extends Record<string, any>>(
    values: T, 
    requiredFields: (keyof T)[]
  ): boolean => {
    return requiredFields.every(field => {
      const value = values[field];
      return value !== null && value !== undefined && value !== '';
    });
  },

  /**
   * Get touched field count
   */
  getTouchedCount: (touched: Record<string, boolean>): number => {
    return Object.values(touched).filter(Boolean).length;
  },

  /**
   * Check if form is ready for submission
   */
  isReadyForSubmission: (
    isValid: boolean,
    isDirty: boolean,
    isSubmitting: boolean,
    hasRequiredFields: boolean = true
  ): boolean => {
    return isValid && isDirty && !isSubmitting && hasRequiredFields;
  }
};

/**
 * Form error message helpers
 */
export const ErrorMessages = {
  // Thai error messages
  th: {
    required: (field: string) => `กรุณาใส่${field}`,
    minLength: (field: string, min: number) => `${field}ต้องมีอย่างน้อย ${min} ตัวอักษร`,
    maxLength: (field: string, max: number) => `${field}ต้องไม่เกิน ${max} ตัวอักษร`,
    min: (field: string, min: number) => `${field}ต้องอย่างน้อย ${min}`,
    max: (field: string, max: number) => `${field}ต้องไม่เกิน ${max}`,
    invalid: (field: string) => `${field}ไม่ถูกต้อง`,
    duplicate: (field: string) => `${field}นี้มีอยู่แล้ว`,
    mismatch: (field1: string, field2: string) => `${field1}และ${field2}ไม่ตรงกัน`
  },
  
  // English error messages
  en: {
    required: (field: string) => `${field} is required`,
    minLength: (field: string, min: number) => `${field} must be at least ${min} characters`,
    maxLength: (field: string, max: number) => `${field} must be no more than ${max} characters`,
    min: (field: string, min: number) => `${field} must be at least ${min}`,
    max: (field: string, max: number) => `${field} must be no more than ${max}`,
    invalid: (field: string) => `Invalid ${field}`,
    duplicate: (field: string) => `${field} already exists`,
    mismatch: (field1: string, field2: string) => `${field1} and ${field2} do not match`
  }
};

/**
 * Form accessibility helpers
 */
export const A11yHelpers = {
  /**
   * Generate ARIA attributes for form fields
   */
  getFieldAria: (fieldId: string, error?: string, required?: boolean) => {
    const aria: Record<string, any> = {
      'aria-describedby': error ? `${fieldId}-error` : undefined,
      'aria-invalid': error ? 'true' : 'false',
      'aria-required': required ? 'true' : 'false'
    };
    
    // Remove undefined values
    Object.keys(aria).forEach(key => {
      if (aria[key] === undefined) {
        delete aria[key];
      }
    });
    
    return aria;
  },

  /**
   * Generate error message ID
   */
  getErrorId: (fieldId: string): string => `${fieldId}-error`,

  /**
   * Generate help text ID
   */
  getHelpId: (fieldId: string): string => `${fieldId}-help`
};

/**
 * Form submission helpers
 */
export const SubmissionHelpers = {
  /**
   * Handle API validation errors
   */
  handleApiErrors: (
    error: any,
    setFieldError: (field: string, error: string) => void,
    setGeneralError: (error: string) => void
  ) => {
    if (error?.validationErrors) {
      // Handle field-specific validation errors
      Object.entries(error.validationErrors).forEach(([field, message]) => {
        setFieldError(field, message as string);
      });
    } else if (error?.message) {
      // Handle general error message
      setGeneralError(error.message);
    } else {
      // Handle unknown errors
      setGeneralError('An unexpected error occurred. Please try again.');
    }
  },

  /**
   * Prepare form data for submission
   */
  prepareSubmissionData: <T extends Record<string, any>>(
    values: T,
    sanitizationMap?: Record<keyof T, string>
  ): T => {
    if (sanitizationMap) {
      return FormSanitizers.sanitizeFormData(values, sanitizationMap);
    }
    return values;
  }
};