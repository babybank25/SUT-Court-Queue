import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAdvancedFormValidation } from '../../../hooks/useAdvancedFormValidation';
import { CommonValidators } from '../../../utils/formValidation';
import { FormField, TextInput, NumberInput, FormButton } from '../FormField';

// Test component using the advanced form validation
const TestForm: React.FC<{
  onSubmit: (data: any) => Promise<void>;
  initialValues?: any;
}> = ({ onSubmit, initialValues = {} }) => {
  const form = useAdvancedFormValidation(
    {
      name: '',
      members: 2,
      contactInfo: '',
      ...initialValues
    },
    {
      validator: CommonValidators.joinQueue,
      sanitize: true,
      validateOnChange: true,
      validateOnBlur: true,
      debounceMs: 100,
      crossFieldValidation: (values) => {
        const errors: Record<string, string> = {};
        
        if (values.name === 'duplicate') {
          errors.name = 'Name already exists';
        }
        
        if (values.members > 5 && values.contactInfo === '') {
          errors.contactInfo = 'Contact info required for large teams';
        }
        
        return errors;
      }
    }
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <form onSubmit={handleSubmit} data-testid="test-form">
      <FormField
        label="Team Name"
        required
        error={form.errors.name}
      >
        <TextInput
          {...form.getFieldProps('name')}
          data-testid="name-input"
        />
      </FormField>

      <FormField
        label="Members"
        required
        error={form.errors.members}
      >
        <NumberInput
          {...form.getFieldProps('members')}
          data-testid="members-input"
          min={1}
          max={10}
        />
      </FormField>

      <FormField
        label="Contact Info"
        error={form.errors.contactInfo}
      >
        <TextInput
          {...form.getFieldProps('contactInfo')}
          data-testid="contact-input"
        />
      </FormField>

      <FormButton
        type="submit"
        loading={form.isSubmitting}
        disabled={!form.isValid && form.submitCount > 0}
        data-testid="submit-button"
      >
        Submit
      </FormButton>

      {/* Debug info */}
      <div data-testid="form-state">
        <span data-testid="is-valid">{form.isValid.toString()}</span>
        <span data-testid="is-dirty">{form.isDirty.toString()}</span>
        <span data-testid="submit-count">{form.submitCount}</span>
        <span data-testid="error-count">{Object.keys(form.errors).filter(k => form.errors[k]).length}</span>
      </div>
    </form>
  );
};

describe('Form Validation', () => {
  const mockSubmit = jest.fn();

  beforeEach(() => {
    mockSubmit.mockClear();
  });

  describe('Basic Validation', () => {
    it('should validate required fields', async () => {
      render(<TestForm onSubmit={mockSubmit} />);
      
      const submitButton = screen.getByTestId('submit-button');
      const nameInput = screen.getByTestId('name-input');
      
      // Try to submit without filling required fields
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('กรุณาใส่ชื่อทีม')).toBeInTheDocument();
      });
      
      expect(mockSubmit).not.toHaveBeenCalled();
      
      // Fill the required field
      await userEvent.type(nameInput, 'Test Team');
      
      await waitFor(() => {
        expect(screen.queryByText('กรุณาใส่ชื่อทีม')).not.toBeInTheDocument();
      });
    });

    it('should validate field length constraints', async () => {
      render(<TestForm onSubmit={mockSubmit} />);
      
      const nameInput = screen.getByTestId('name-input');
      
      // Test minimum length
      await userEvent.type(nameInput, '');
      fireEvent.blur(nameInput);
      
      await waitFor(() => {
        expect(screen.getByText('กรุณาใส่ชื่อทีม')).toBeInTheDocument();
      });
      
      // Test maximum length (over 50 characters)
      const longName = 'A'.repeat(51);
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, longName);
      fireEvent.blur(nameInput);
      
      await waitFor(() => {
        expect(screen.getByText('ชื่อทีมต้องไม่เกิน 50 ตัวอักษร')).toBeInTheDocument();
      });
    });

    it('should validate number ranges', async () => {
      render(<TestForm onSubmit={mockSubmit} />);
      
      const membersInput = screen.getByTestId('members-input');
      
      // Test minimum value
      await userEvent.clear(membersInput);
      await userEvent.type(membersInput, '0');
      fireEvent.blur(membersInput);
      
      await waitFor(() => {
        expect(screen.getByText('จำนวนผู้เล่นต้องอย่างน้อย 1 คน')).toBeInTheDocument();
      });
      
      // Test maximum value
      await userEvent.clear(membersInput);
      await userEvent.type(membersInput, '11');
      fireEvent.blur(membersInput);
      
      await waitFor(() => {
        expect(screen.getByText('จำนวนผู้เล่นต้องไม่เกิน 10 คน')).toBeInTheDocument();
      });
    });

    it('should validate pattern matching', async () => {
      render(<TestForm onSubmit={mockSubmit} />);
      
      const nameInput = screen.getByTestId('name-input');
      
      // Test invalid characters
      await userEvent.type(nameInput, 'Team@#$%');
      fireEvent.blur(nameInput);
      
      await waitFor(() => {
        expect(screen.getByText('ชื่อทีมใช้ได้เฉพาะตัวอักษร ตัวเลข และช่องว่าง')).toBeInTheDocument();
      });
    });
  });

  describe('Cross-field Validation', () => {
    it('should validate cross-field dependencies', async () => {
      render(<TestForm onSubmit={mockSubmit} />);
      
      const nameInput = screen.getByTestId('name-input');
      const membersInput = screen.getByTestId('members-input');
      const contactInput = screen.getByTestId('contact-input');
      
      // Fill form with values that trigger cross-field validation
      await userEvent.type(nameInput, 'Test Team');
      await userEvent.clear(membersInput);
      await userEvent.type(membersInput, '6'); // More than 5 members
      
      // Leave contact info empty - should trigger cross-field validation
      fireEvent.blur(contactInput);
      
      await waitFor(() => {
        expect(screen.getByText('Contact info required for large teams')).toBeInTheDocument();
      });
    });

    it('should validate duplicate names', async () => {
      render(<TestForm onSubmit={mockSubmit} />);
      
      const nameInput = screen.getByTestId('name-input');
      
      await userEvent.type(nameInput, 'duplicate');
      fireEvent.blur(nameInput);
      
      await waitFor(() => {
        expect(screen.getByText('Name already exists')).toBeInTheDocument();
      });
    });
  });

  describe('Form State Management', () => {
    it('should track form state correctly', async () => {
      render(<TestForm onSubmit={mockSubmit} />);
      
      const nameInput = screen.getByTestId('name-input');
      const isValidElement = screen.getByTestId('is-valid');
      const isDirtyElement = screen.getByTestId('is-dirty');
      
      // Initial state
      expect(isValidElement.textContent).toBe('true');
      expect(isDirtyElement.textContent).toBe('false');
      
      // After typing
      await userEvent.type(nameInput, 'Test');
      
      await waitFor(() => {
        expect(isDirtyElement.textContent).toBe('true');
      });
    });

    it('should handle form submission correctly', async () => {
      mockSubmit.mockResolvedValue(undefined);
      
      render(<TestForm onSubmit={mockSubmit} />);
      
      const nameInput = screen.getByTestId('name-input');
      const submitButton = screen.getByTestId('submit-button');
      
      // Fill valid data
      await userEvent.type(nameInput, 'Valid Team');
      
      // Submit form
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith({
          name: 'Valid Team',
          members: 2,
          contactInfo: ''
        });
      });
    });

    it('should handle submission errors', async () => {
      mockSubmit.mockRejectedValue(new Error('Submission failed'));
      
      render(<TestForm onSubmit={mockSubmit} />);
      
      const nameInput = screen.getByTestId('name-input');
      const submitButton = screen.getByTestId('submit-button');
      
      // Fill valid data
      await userEvent.type(nameInput, 'Valid Team');
      
      // Submit form
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalled();
      });
      
      // Form should not be submitting after error
      await waitFor(() => {
        expect(submitButton).not.toHaveAttribute('disabled');
      });
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize input values', async () => {
      render(<TestForm onSubmit={mockSubmit} />);
      
      const nameInput = screen.getByTestId('name-input');
      
      // Type input with extra spaces and special characters
      await userEvent.type(nameInput, '  Test   Team  ');
      
      // The input should be sanitized
      await waitFor(() => {
        expect(nameInput).toHaveValue('Test Team');
      });
    });

    it('should sanitize numbers within range', async () => {
      render(<TestForm onSubmit={mockSubmit} />);
      
      const membersInput = screen.getByTestId('members-input');
      
      // Type a number outside the valid range
      await userEvent.clear(membersInput);
      await userEvent.type(membersInput, '15');
      
      // Should be sanitized to maximum value
      await waitFor(() => {
        expect(membersInput).toHaveValue(10);
      });
    });
  });

  describe('Debounced Validation', () => {
    it('should debounce validation on change', async () => {
      jest.useFakeTimers();
      
      render(<TestForm onSubmit={mockSubmit} />);
      
      const nameInput = screen.getByTestId('name-input');
      
      // Type rapidly
      await userEvent.type(nameInput, 'T');
      await userEvent.type(nameInput, 'e');
      await userEvent.type(nameInput, 's');
      await userEvent.type(nameInput, 't');
      
      // Validation should not have run yet
      expect(screen.queryByText('กรุณาใส่ชื่อทีม')).not.toBeInTheDocument();
      
      // Fast-forward time to trigger debounced validation
      jest.advanceTimersByTime(200);
      
      await waitFor(() => {
        // Should be valid now
        expect(screen.queryByText('กรุณาใส่ชื่อทีม')).not.toBeInTheDocument();
      });
      
      jest.useRealTimers();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<TestForm onSubmit={mockSubmit} />);
      
      const nameInput = screen.getByTestId('name-input');
      
      expect(nameInput).toHaveAttribute('aria-required', 'true');
      expect(nameInput).toHaveAttribute('aria-invalid', 'false');
    });

    it('should update ARIA attributes when validation fails', async () => {
      render(<TestForm onSubmit={mockSubmit} />);
      
      const nameInput = screen.getByTestId('name-input');
      const submitButton = screen.getByTestId('submit-button');
      
      // Submit without filling required field
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(nameInput).toHaveAttribute('aria-invalid', 'true');
      });
    });
  });
});