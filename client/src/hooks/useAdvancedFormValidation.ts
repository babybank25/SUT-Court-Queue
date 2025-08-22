import { useState, useCallback, useEffect, useMemo } from 'react';
import { FormValidator, ValidationResult, InputSanitizer } from '../utils/formValidation';

interface ValidationOptions {
  validator: FormValidator;
  sanitize?: boolean;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
  crossFieldValidation?: (values: any) => Record<string, string>;
}

interface FormState<T> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
  submitCount: number;
}

interface FormActions<T> {
  setValue: (field: keyof T, value: any) => void;
  setValues: (values: Partial<T>) => void;
  setError: (field: keyof T, error: string) => void;
  setErrors: (errors: Record<string, string>) => void;
  clearError: (field: keyof T) => void;
  clearErrors: () => void;
  validateField: (field: keyof T) => Promise<string | null>;
  validateAll: () => Promise<ValidationResult>;
  reset: (newValues?: T) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  setTouched: (field: keyof T, touched?: boolean) => void;
  handleSubmit: (onSubmit: (values: T) => Promise<void> | void) => (e?: React.FormEvent) => Promise<void>;
}

interface FormHelpers<T> {
  getFieldProps: (field: keyof T) => {
    value: any;
    error?: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onBlur: () => void;
  };
  getCheckboxProps: (field: keyof T) => {
    checked: boolean;
    error?: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur: () => void;
  };
  getRadioProps: (field: keyof T, value: any) => {
    checked: boolean;
    error?: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur: () => void;
  };
}

export function useAdvancedFormValidation<T extends Record<string, any>>(
  initialValues: T,
  options: ValidationOptions
): FormState<T> & FormActions<T> & FormHelpers<T> {
  const {
    validator,
    sanitize = true,
    validateOnChange = false,
    validateOnBlur = true,
    debounceMs = 300,
    crossFieldValidation
  } = options;

  const [state, setState] = useState<FormState<T>>({
    values: initialValues,
    errors: {},
    touched: {},
    isValid: true,
    isSubmitting: false,
    isDirty: false,
    submitCount: 0
  });

  // Debounced validation
  const [validationTimeout, setValidationTimeout] = useState<NodeJS.Timeout | null>(null);

  // Memoized sanitization function
  const sanitizeValue = useCallback((field: keyof T, value: any): any => {
    if (!sanitize) return value;

    const fieldName = String(field);
    
    if (typeof value === 'string') {
      switch (fieldName) {
        case 'name':
          return InputSanitizer.sanitizeTeamName(value);
        case 'contactInfo':
          return InputSanitizer.sanitizeContactInfo(value);
        case 'username':
          return InputSanitizer.sanitizeUsername(value);
        case 'password':
          return InputSanitizer.sanitizePassword(value);
        case 'email':
          return InputSanitizer.sanitizeEmail(value);
        case 'phone':
          return InputSanitizer.sanitizePhone(value);
        case 'url':
          return InputSanitizer.sanitizeUrl(value);
        default:
          return InputSanitizer.sanitizeString(value);
      }
    } else if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)))) {
      switch (fieldName) {
        case 'members':
          return InputSanitizer.sanitizeNumber(value, 1, 10);
        case 'wins':
          return InputSanitizer.sanitizeNumber(value, 0, 9999);
        case 'targetScore':
          return InputSanitizer.sanitizeNumber(value, 1, 100);
        case 'score1':
        case 'score2':
          return InputSanitizer.sanitizeNumber(value, 0, 999);
        case 'maxSize':
          return InputSanitizer.sanitizeNumber(value, 1, 50);
        default:
          return typeof value === 'number' ? value : InputSanitizer.sanitizeNumber(value);
      }
    }
    
    return value;
  }, [sanitize]);

  // Validate single field
  const validateField = useCallback(async (field: keyof T): Promise<string | null> => {
    const fieldName = String(field);
    const value = state.values[field];
    
    // Basic field validation
    const error = validator.validateField(fieldName, value);
    
    setState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [field]: error || ''
      }
    }));

    return error;
  }, [validator, state.values]);

  // Validate all fields including cross-field validation
  const validateAll = useCallback(async (): Promise<ValidationResult> => {
    const result = validator.validate(state.values);
    let allErrors = { ...result.fieldErrors };

    // Apply cross-field validation if provided
    if (crossFieldValidation) {
      const crossErrors = crossFieldValidation(state.values);
      allErrors = { ...allErrors, ...crossErrors };
    }

    const isValid = Object.keys(allErrors).length === 0;

    setState(prev => ({
      ...prev,
      errors: allErrors,
      isValid
    }));

    return {
      isValid,
      errors: Object.entries(allErrors).map(([field, message]) => ({ field, message })),
      fieldErrors: allErrors
    };
  }, [validator, state.values, crossFieldValidation]);

  // Set field value with sanitization and optional validation
  const setValue = useCallback((field: keyof T, value: any) => {
    const sanitizedValue = sanitizeValue(field, value);
    
    setState(prev => ({
      ...prev,
      values: {
        ...prev.values,
        [field]: sanitizedValue
      },
      isDirty: true
    }));

    // Debounced validation on change
    if (validateOnChange) {
      if (validationTimeout) {
        clearTimeout(validationTimeout);
      }
      
      const timeout = setTimeout(() => {
        validateField(field);
      }, debounceMs);
      
      setValidationTimeout(timeout);
    }
  }, [sanitizeValue, validateOnChange, debounceMs, validateField, validationTimeout]);

  // Set multiple values
  const setValues = useCallback((values: Partial<T>) => {
    const sanitizedValues = Object.entries(values).reduce((acc, [key, value]) => {
      acc[key as keyof T] = sanitizeValue(key as keyof T, value);
      return acc;
    }, {} as Partial<T>);

    setState(prev => ({
      ...prev,
      values: {
        ...prev.values,
        ...sanitizedValues
      },
      isDirty: true
    }));
  }, [sanitizeValue]);

  // Set field error
  const setError = useCallback((field: keyof T, error: string) => {
    setState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [field]: error
      }
    }));
  }, []);

  // Set multiple errors
  const setErrors = useCallback((errors: Record<string, string>) => {
    setState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        ...errors
      }
    }));
  }, []);

  // Clear field error
  const clearError = useCallback((field: keyof T) => {
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

  // Set touched state
  const setTouched = useCallback((field: keyof T, touched = true) => {
    setState(prev => ({
      ...prev,
      touched: {
        ...prev.touched,
        [field]: touched
      }
    }));

    // Validate on blur if enabled
    if (touched && validateOnBlur) {
      validateField(field);
    }
  }, [validateOnBlur, validateField]);

  // Reset form
  const reset = useCallback((newValues?: T) => {
    setState({
      values: newValues || initialValues,
      errors: {},
      touched: {},
      isValid: true,
      isSubmitting: false,
      isDirty: false,
      submitCount: 0
    });
  }, [initialValues]);

  // Set submitting state
  const setSubmitting = useCallback((isSubmitting: boolean) => {
    setState(prev => ({
      ...prev,
      isSubmitting
    }));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback((onSubmit: (values: T) => Promise<void> | void) => {
    return async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
      }

      setState(prev => ({
        ...prev,
        isSubmitting: true,
        submitCount: prev.submitCount + 1
      }));

      try {
        // Validate all fields before submission
        const validationResult = await validateAll();
        
        if (!validationResult.isValid) {
          // Mark all fields as touched to show errors
          const allTouched = Object.keys(state.values).reduce((acc, key) => {
            acc[key] = true;
            return acc;
          }, {} as Record<string, boolean>);
          
          setState(prev => ({
            ...prev,
            touched: allTouched,
            isSubmitting: false
          }));
          return;
        }

        // Submit the form
        await onSubmit(state.values);
        
        setState(prev => ({
          ...prev,
          isSubmitting: false
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          isSubmitting: false
        }));
        throw error;
      }
    };
  }, [validateAll, state.values]);

  // Helper functions for form field props
  const getFieldProps = useCallback((field: keyof T) => {
    return {
      value: state.values[field] || '',
      error: state.touched[field] ? state.errors[String(field)] : undefined,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
        setValue(field, value);
      },
      onBlur: () => setTouched(field, true)
    };
  }, [state.values, state.errors, state.touched, setValue, setTouched]);

  const getCheckboxProps = useCallback((field: keyof T) => {
    return {
      checked: Boolean(state.values[field]),
      error: state.touched[field] ? state.errors[String(field)] : undefined,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        setValue(field, e.target.checked);
      },
      onBlur: () => setTouched(field, true)
    };
  }, [state.values, state.errors, state.touched, setValue, setTouched]);

  const getRadioProps = useCallback((field: keyof T, value: any) => {
    return {
      checked: state.values[field] === value,
      error: state.touched[field] ? state.errors[String(field)] : undefined,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
          setValue(field, value);
        }
      },
      onBlur: () => setTouched(field, true)
    };
  }, [state.values, state.errors, state.touched, setValue, setTouched]);

  // Update isValid when errors change
  const hasErrors = useMemo(() => {
    return Object.values(state.errors).some(error => error && error.length > 0);
  }, [state.errors]);

  useEffect(() => {
    setState(prev => ({
      ...prev,
      isValid: !hasErrors
    }));
  }, [hasErrors]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeout) {
        clearTimeout(validationTimeout);
      }
    };
  }, [validationTimeout]);

  return {
    // State
    values: state.values,
    errors: state.errors,
    touched: state.touched,
    isValid: state.isValid && !hasErrors,
    isSubmitting: state.isSubmitting,
    isDirty: state.isDirty,
    submitCount: state.submitCount,

    // Actions
    setValue,
    setValues,
    setError,
    setErrors,
    clearError,
    clearErrors,
    validateField,
    validateAll,
    reset,
    setSubmitting,
    setTouched,
    handleSubmit,

    // Helpers
    getFieldProps,
    getCheckboxProps,
    getRadioProps
  };
}