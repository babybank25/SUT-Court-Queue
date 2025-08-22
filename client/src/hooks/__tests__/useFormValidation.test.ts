import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useFormValidation } from '../useFormValidation';

describe('useFormValidation', () => {
  const validationRules = {
    name: {
      required: true,
      minLength: 2,
      maxLength: 50,
    },
    email: {
      required: false,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    age: {
      required: true,
      min: 1,
      max: 100,
    },
  };

  const initialValues = {
    name: '',
    email: '',
    age: 0,
  };

  it('should initialize with initial values', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    );

    expect(result.current.values).toEqual(initialValues);
    expect(result.current.errors).toEqual({});
    expect(result.current.isValid).toBe(false);
    expect(result.current.touched).toEqual({});
  });

  it('should update values', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    );

    act(() => {
      result.current.setValue('name', 'John Doe');
    });

    expect(result.current.values.name).toBe('John Doe');
  });

  it('should validate required fields', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    );

    act(() => {
      result.current.validateField('name');
    });

    expect(result.current.errors.name).toBe('This field is required');
    expect(result.current.isValid).toBe(false);
  });

  it('should validate minimum length', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    );

    act(() => {
      result.current.setValue('name', 'A');
      result.current.validateField('name');
    });

    expect(result.current.errors.name).toBe('Must be at least 2 characters');
  });

  it('should validate maximum length', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    );

    act(() => {
      result.current.setValue('name', 'A'.repeat(51));
      result.current.validateField('name');
    });

    expect(result.current.errors.name).toBe('Must be no more than 50 characters');
  });

  it('should validate minimum value', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    );

    act(() => {
      result.current.setValue('age', 0);
      result.current.validateField('age');
    });

    expect(result.current.errors.age).toBe('Must be at least 1');
  });

  it('should validate maximum value', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    );

    act(() => {
      result.current.setValue('age', 101);
      result.current.validateField('age');
    });

    expect(result.current.errors.age).toBe('Must be no more than 100');
  });

  it('should validate pattern', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    );

    act(() => {
      result.current.setValue('email', 'invalid-email');
      result.current.validateField('email');
    });

    expect(result.current.errors.email).toBe('Invalid format');
  });

  it('should not validate optional empty fields', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    );

    act(() => {
      result.current.setValue('email', '');
      result.current.validateField('email');
    });

    expect(result.current.errors.email).toBeUndefined();
  });

  it('should validate all fields', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    );

    act(() => {
      result.current.validateAll();
    });

    expect(result.current.errors.name).toBe('This field is required');
    expect(result.current.errors.age).toBe('Must be at least 1');
    expect(result.current.isValid).toBe(false);
  });

  it('should be valid when all validations pass', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    );

    act(() => {
      result.current.setValue('name', 'John Doe');
      result.current.setValue('email', 'john@example.com');
      result.current.setValue('age', 25);
      result.current.validateAll();
    });

    expect(result.current.errors).toEqual({});
    expect(result.current.isValid).toBe(true);
  });

  it('should track touched fields', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    );

    act(() => {
      result.current.setTouched('name', true);
    });

    expect(result.current.touched.name).toBe(true);
  });

  it('should clear errors', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    );

    act(() => {
      result.current.validateField('name');
    });

    expect(result.current.errors.name).toBeDefined();

    act(() => {
      result.current.clearErrors();
    });

    expect(result.current.errors).toEqual({});
  });

  it('should reset form', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    );

    act(() => {
      result.current.setValue('name', 'John Doe');
      result.current.setTouched('name', true);
      result.current.validateField('name');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.values).toEqual(initialValues);
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
  });

  it('should handle custom validation functions', () => {
    const customRules = {
      password: {
        required: true,
        custom: (value: string) => {
          if (value.length < 8) return 'Password must be at least 8 characters';
          if (!/[A-Z]/.test(value)) return 'Password must contain uppercase letter';
          if (!/[0-9]/.test(value)) return 'Password must contain a number';
          return null;
        },
      },
    };

    const { result } = renderHook(() => 
      useFormValidation({ password: '' }, customRules)
    );

    act(() => {
      result.current.setValue('password', 'weak');
      result.current.validateField('password');
    });

    expect(result.current.errors.password).toBe('Password must be at least 8 characters');

    act(() => {
      result.current.setValue('password', 'weakpassword');
      result.current.validateField('password');
    });

    expect(result.current.errors.password).toBe('Password must contain uppercase letter');

    act(() => {
      result.current.setValue('password', 'WeakPassword');
      result.current.validateField('password');
    });

    expect(result.current.errors.password).toBe('Password must contain a number');

    act(() => {
      result.current.setValue('password', 'StrongPassword123');
      result.current.validateField('password');
    });

    expect(result.current.errors.password).toBeUndefined();
  });

  it('should handle async validation', async () => {
    const asyncRules = {
      username: {
        required: true,
        asyncValidator: async (value: string) => {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (value === 'taken') return 'Username is already taken';
          return null;
        },
      },
    };

    const { result } = renderHook(() => 
      useFormValidation({ username: '' }, asyncRules)
    );

    act(() => {
      result.current.setValue('username', 'taken');
    });

    await act(async () => {
      await result.current.validateField('username');
    });

    expect(result.current.errors.username).toBe('Username is already taken');
  });

  it('should handle form submission', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    );

    act(() => {
      result.current.setValue('name', 'John Doe');
      result.current.setValue('age', 25);
    });

    act(() => {
      result.current.handleSubmit(onSubmit)();
    });

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'John Doe',
      email: '',
      age: 25,
    });
  });

  it('should not submit invalid form', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    );

    act(() => {
      result.current.handleSubmit(onSubmit)();
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.errors.name).toBe('This field is required');
  });

  it('should handle field blur events', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    );

    act(() => {
      result.current.handleBlur('name');
    });

    expect(result.current.touched.name).toBe(true);
    expect(result.current.errors.name).toBe('This field is required');
  });

  it('should handle field change events', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    );

    const mockEvent = {
      target: { name: 'name', value: 'John Doe' }
    } as React.ChangeEvent<HTMLInputElement>;

    act(() => {
      result.current.handleChange(mockEvent);
    });

    expect(result.current.values.name).toBe('John Doe');
  });
});