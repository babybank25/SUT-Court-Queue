import { useState, useCallback, useEffect } from 'react';
import { FormValidator, ValidationResult, InputSanitizer } from '../utils/formValidation';

interface UseFormValidationOptions {
  validator: FormValidator;
  sanitize?: boolean;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

interface FormState<T> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
}

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  options: UseFormValidationOptions
) {
  const { validator, sanitize = true, validateOnChange = false, validateOnBlur = true } = options;

  const [state, setState] = useState<FormState<T>>({
    values: initialValues,
    errors: {},
    touched: {},
    isValid: true,
    isSubmitting: false,
    isDirty: false
  });

  // Validate all fields
  const validateAll = useCallback((): ValidationResult => {
    const result = validator.validate(state.values);
    
    setState(prev => ({
      ...prev,
      errors: result.fieldErrors,
      isValid: result.isValid
    }));

    return result;
  }, [validator, state.values]);

  // Validate single field
  const validateField = useCallback((field: string, value: any): string | null => {
    const error = validator.validateField(field, value);
    
    setState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [field]: error || ''
      }
    }));

    return error;
  }, [validator]);

  // Set field value
  const setValue = useCallback((field: string, value: any) => {
    let sanitizedValue = value;
    
    // Apply sanitization if enabled
    if (sanitize) {
      if (typeof value === 'string') {
        switch (field) {
          case 'name':
            sanitizedValue = InputSanitizer.sanitizeTeamName(value);
            break;
          case 'contactInfo':
            sanitizedValue = InputSanitizer.sanitizeContactInfo(value);
            break;
          case 'username':
            sanitizedValue = InputSanitizer.sanitizeUsername(value);
            break;
          case 'password':
            sanitizedValue = InputSanitizer.sanitizePassword(value);
            break;
          case 'email':
            sanitizedValue = InputSanitizer.sanitizeEmail(value);
            break;
          case 'phone':
            sanitizedValue = InputSanitizer.sanitizePhone(value);
            break;
          case 'url':
            sanitizedValue = InputSanitizer.sanitizeUrl(value);
            break;
          default:
            sanitizedValue = InputSanitizer.sanitizeString(value);
        }
      } else if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)))) {
        switch (field) {
          case 'members':
            sanitizedValue = InputSanitizer.sanitizeNumber(value, 1, 10);
            break;
          case 'wins':
            sanitizedValue = InputSanitizer.sanitizeNumber(value, 0, 9999);
            break;
          case 'targetScore':
            sanitizedValue = InputSanitizer.sanitizeNumber(value, 1, 100);
            break;
          case 'score1':
          case 'score2':
            sanitizedValue = InputSanitizer.sanitizeNumber(value, 0, 999);
            break;
          case 'maxSize':
            sanitizedValue = InputSanitizer.sanitizeNumber(value, 1, 50);
            break;
          default:
            if (typeof value === 'number') {
              sanitizedValue = value;
            } else {
              sanitizedValue = InputSanitizer.sanitizeNumber(value);
            }
        }
      }
    }

    setState(prev => ({
      ...prev,
      values: {
        ...prev.values,
        [field]: sanitizedValue
      },
      isDirty: true
    }));

    // Validate on change if enabled
    if (validateOnChange) {
      validateField(field, sanitizedValue);
    }
  }, [sanitize, validateOnChange, validateField]);

  // Set multiple values
  const setValues = useCallback((values: Partial<T>) => {
    setState(prev => ({
      ...prev,
      values: {
        ...prev.values,
        ...values
      },
      isDirty: true
    }));
  }, []);

  // Handle field blur
  const handleBlur = useCallback((field: string) => {
    setState(prev => ({
      ...prev,
      touched: {
        ...prev.touched,
        [field]: true
      }
    }));

    // Validate on blur if enabled
    if (validateOnBlur) {
      validateField(field, state.values[field]);
    }
  }, [validateOnBlur, validateField, state.values]);

  // Handle field change
  const handleChange = useCallback((field: string, value: any) => {
    setValue(field, value);
  }, [setValue]);

  // Get field props for easy integration with form components
  const getFieldProps = useCallback((field: string) => {
    return {
      value: state.values[field] || '',
      error: state.touched[field] ? state.errors[field] : undefined,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
        handleChange(field, value);
      },
      onBlur: () => handleBlur(field)
    };
  }, [state.values, state.errors, state.touched, handleChange, handleBlur]);

  // Get checkbox field props
  const getCheckboxProps = useCallback((field: string) => {
    return {
      checked: Boolean(state.values[field]),
      error: state.touched[field] ? state.errors[field] : undefined,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        handleChange(field, e.target.checked);
      },
      onBlur: () => handleBlur(field)
    };
  }, [state.values, state.errors, state.touched, handleChange, handleBlur]);

  // Reset form
  const reset = useCallback((newValues?: T) => {
    setState({
      values: newValues || initialValues,
      errors: {},
      touched: {},
      isValid: true,
      isSubmitting: false,
      isDirty: false
    });
  }, [initialValues]);

  // Set submitting state
  const setSubmitting = useCallback((isSubmitting: boolean) => {
    setState(prev => ({
      ...prev,
      isSubmitting
    }));
  }, []);

  // Set errors from external source (e.g., API)
  const setErrors = useCallback((errors: Record<string, string>) => {
    setState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        ...errors
      },
      isValid: Object.keys(errors).length === 0
    }));
  }, []);

  // Clear specific error
  const clearError = useCallback((field: string) => {
    setState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [field]: ''
      }
    }));
  }, []);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setState(prev => ({
      ...prev,
      errors: {},
      isValid: true
    }));
  }, []);

  // Check if form has any errors
  const hasErrors = Object.values(state.errors).some(error => error && error.length > 0);

  // Update isValid when errors change
  useEffect(() => {
    const isValid = !hasErrors;
    setState(prev => ({
      ...prev,
      isValid
    }));
  }, [hasErrors]);

  return {
    // State
    values: state.values,
    errors: state.errors,
    touched: state.touched,
    isValid: state.isValid && !hasErrors,
    isSubmitting: state.isSubmitting,
    isDirty: state.isDirty,
    hasErrors,

    // Actions
    setValue,
    setValues,
    handleChange,
    handleBlur,
    validateAll,
    validateField,
    reset,
    setSubmitting,
    setErrors,
    clearError,
    clearErrors,

    // Helpers
    getFieldProps,
    getCheckboxProps
  };
}