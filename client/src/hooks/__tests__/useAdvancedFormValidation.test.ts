import { renderHook, act } from '@testing-library/react';
import { useFormValidation } from '../useFormValidation';
import { FormValidator } from '../../utils/formValidation';

// Mock form validator
const mockValidator: FormValidator = {
  validate: jest.fn(),
  validateField: jest.fn()
};

describe('useFormValidation', () => {
  const initialValues = {
    name: '',
    members: 5,
    contactInfo: ''
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (mockValidator.validate as jest.Mock).mockReturnValue({
      isValid: true,
      fieldErrors: {}
    });
    (mockValidator.validateField as jest.Mock).mockReturnValue(null);
  });

  it('initializes with provided values', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, { validator: mockValidator })
    );

    expect(result.current.values).toEqual(initialValues);
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
    expect(result.current.isValid).toBe(true);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.isDirty).toBe(false);
  });

  it('updates field values', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, { validator: mockValidator })
    );

    act(() => {
      result.current.setValue('name', 'Team Alpha');
    });

    expect(result.current.values.name).toBe('Team Alpha');
    expect(result.current.isDirty).toBe(true);
  });

  it('sanitizes string inputs', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, { 
        validator: mockValidator,
        sanitize: true 
      })
    );

    act(() => {
      result.current.setValue('name', '  Team Alpha  ');
    });

    // Should be trimmed (basic sanitization)
    expect(result.current.values.name).toBe('Team Alpha');
  });

  it('sanitizes number inputs', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, { 
        validator: mockValidator,
        sanitize: true 
      })
    );

    act(() => {
      result.current.setValue('members', '15'); // String number
    });

    expect(result.current.values.members).toBe(10); // Clamped to max 10
  });

  it('validates on change when enabled', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, { 
        validator: mockValidator,
        validateOnChange: true 
      })
    );

    act(() => {
      result.current.setValue('name', 'Team Alpha');
    });

    expect(mockValidator.validateField).toHaveBeenCalledWith('name', 'Team Alpha');
  });

  it('validates on blur when enabled', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, { 
        validator: mockValidator,
        validateOnBlur: true 
      })
    );

    act(() => {
      result.current.handleBlur('name');
    });

    expect(result.current.touched.name).toBe(true);
    expect(mockValidator.validateField).toHaveBeenCalledWith('name', '');
  });

  it('sets multiple values at once', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, { validator: mockValidator })
    );

    act(() => {
      result.current.setValues({
        name: 'Team Beta',
        members: 6
      });
    });

    expect(result.current.values.name).toBe('Team Beta');
    expect(result.current.values.members).toBe(6);
    expect(result.current.isDirty).toBe(true);
  });

  it('validates all fields', () => {
    const mockValidationResult = {
      isValid: false,
      fieldErrors: {
        name: 'Name is required',
        members: 'Invalid number of members'
      }
    };

    (mockValidator.validate as jest.Mock).mockReturnValue(mockValidationResult);

    const { result } = renderHook(() => 
      useFormValidation(initialValues, { validator: mockValidator })
    );

    let validationResult;
    act(() => {
      validationResult = result.current.validateAll();
    });

    expect(validationResult).toEqual(mockValidationResult);
    expect(result.current.errors).toEqual(mockValidationResult.fieldErrors);
    expect(result.current.isValid).toBe(false);
  });

  it('validates single field', () => {
    (mockValidator.validateField as jest.Mock).mockReturnValue('Name is required');

    const { result } = renderHook(() => 
      useFormValidation(initialValues, { validator: mockValidator })
    );

    let error;
    act(() => {
      error = result.current.validateField('name', '');
    });

    expect(error).toBe('Name is required');
    expect(result.current.errors.name).toBe('Name is required');
  });

  it('provides field props for form integration', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, { validator: mockValidator })
    );

    const fieldProps = result.current.getFieldProps('name');

    expect(fieldProps.value).toBe('');
    expect(fieldProps.error).toBeUndefined();
    expect(typeof fieldProps.onChange).toBe('function');
    expect(typeof fieldProps.onBlur).toBe('function');
  });

  it('provides checkbox props for form integration', () => {
    const booleanInitialValues = { ...initialValues, isActive: false };
    const { result } = renderHook(() => 
      useFormValidation(booleanInitialValues, { validator: mockValidator })
    );

    const checkboxProps = result.current.getCheckboxProps('isActive');

    expect(checkboxProps.checked).toBe(false);
    expect(checkboxProps.error).toBeUndefined();
    expect(typeof checkboxProps.onChange).toBe('function');
    expect(typeof checkboxProps.onBlur).toBe('function');
  });

  it('handles form reset', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, { validator: mockValidator })
    );

    // Make some changes
    act(() => {
      result.current.setValue('name', 'Team Gamma');
      result.current.setErrors({ name: 'Some error' });
    });

    expect(result.current.isDirty).toBe(true);
    expect(result.current.errors.name).toBe('Some error');

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.values).toEqual(initialValues);
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
    expect(result.current.isDirty).toBe(false);
  });

  it('resets with new values', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, { validator: mockValidator })
    );

    const newValues = { name: 'New Team', members: 7, contactInfo: 'new@example.com' };

    act(() => {
      result.current.reset(newValues);
    });

    expect(result.current.values).toEqual(newValues);
  });

  it('manages submitting state', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, { validator: mockValidator })
    );

    act(() => {
      result.current.setSubmitting(true);
    });

    expect(result.current.isSubmitting).toBe(true);

    act(() => {
      result.current.setSubmitting(false);
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it('sets external errors', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, { validator: mockValidator })
    );

    const externalErrors = {
      name: 'Server validation error',
      contactInfo: 'Invalid email format'
    };

    act(() => {
      result.current.setErrors(externalErrors);
    });

    expect(result.current.errors).toEqual(externalErrors);
    expect(result.current.isValid).toBe(false);
  });

  it('clears specific error', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, { validator: mockValidator })
    );

    act(() => {
      result.current.setErrors({ name: 'Error', contactInfo: 'Another error' });
    });

    act(() => {
      result.current.clearError('name');
    });

    expect(result.current.errors.name).toBe('');
    expect(result.current.errors.contactInfo).toBe('Another error');
  });

  it('clears all errors', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, { validator: mockValidator })
    );

    act(() => {
      result.current.setErrors({ name: 'Error', contactInfo: 'Another error' });
    });

    act(() => {
      result.current.clearErrors();
    });

    expect(result.current.errors).toEqual({});
    expect(result.current.isValid).toBe(true);
  });

  it('handles change events from form elements', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, { validator: mockValidator })
    );

    const fieldProps = result.current.getFieldProps('name');

    act(() => {
      fieldProps.onChange({
        target: { value: 'Team Delta', type: 'text' }
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.values.name).toBe('Team Delta');
  });

  it('handles number input change events', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, { validator: mockValidator })
    );

    const fieldProps = result.current.getFieldProps('members');

    act(() => {
      fieldProps.onChange({
        target: { value: '8', type: 'number' }
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.values.members).toBe(8);
  });

  it('handles checkbox change events', () => {
    const booleanInitialValues = { ...initialValues, isActive: false };
    const { result } = renderHook(() => 
      useFormValidation(booleanInitialValues, { validator: mockValidator })
    );

    const checkboxProps = result.current.getCheckboxProps('isActive');

    act(() => {
      checkboxProps.onChange({
        target: { checked: true }
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.values.isActive).toBe(true);
  });

  it('shows errors only for touched fields', () => {
    (mockValidator.validateField as jest.Mock).mockReturnValue('Field error');

    const { result } = renderHook(() => 
      useFormValidation(initialValues, { 
        validator: mockValidator,
        validateOnBlur: true 
      })
    );

    const fieldProps = result.current.getFieldProps('name');

    // Error should not show initially
    expect(fieldProps.error).toBeUndefined();

    // Touch the field
    act(() => {
      result.current.handleBlur('name');
    });

    const updatedFieldProps = result.current.getFieldProps('name');
    expect(updatedFieldProps.error).toBe('Field error');
  });
});