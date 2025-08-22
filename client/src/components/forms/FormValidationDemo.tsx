import React from 'react';
import { useAdvancedFormValidation } from '../../hooks/useAdvancedFormValidation';
import { CommonValidators } from '../../utils/formValidation';
import { 
  FormField, 
  TextInput, 
  NumberInput, 
  Select, 
  FormButton, 
  FormGroup, 
  FormSection 
} from './FormField';

interface DemoFormData {
  teamName: string;
  members: number;
  contactInfo: string;
  email: string;
  status: 'waiting' | 'playing' | 'cooldown';
}

export const FormValidationDemo: React.FC = () => {
  const form = useAdvancedFormValidation<DemoFormData>(
    {
      teamName: '',
      members: 2,
      contactInfo: '',
      email: '',
      status: 'waiting' as const
    },
    {
      validator: CommonValidators.teamEdit,
      sanitize: true,
      validateOnChange: true,
      validateOnBlur: true,
      debounceMs: 300,
      crossFieldValidation: (values) => {
        const errors: Record<string, string> = {};
        
        // Example cross-field validation
        if (values.status === 'playing' && values.members < 2) {
          errors.members = 'Playing teams must have at least 2 members';
        }
        
        if (values.members > 5 && !values.contactInfo) {
          errors.contactInfo = 'Contact info required for teams with more than 5 members';
        }
        
        return errors;
      }
    }
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Form submitted:', values);
    alert('Form submitted successfully!');
  });

  const statusOptions = [
    { value: 'waiting', label: 'Waiting' },
    { value: 'playing', label: 'Playing' },
    { value: 'cooldown', label: 'Cooldown' }
  ];

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Enhanced Form Validation Demo
      </h2>
      
      <form onSubmit={handleSubmit}>
        <FormGroup>
          <FormSection
            title="Team Information"
            description="Basic information about the team"
          >
            <FormField
              label="Team Name"
              required
              error={form.errors.teamName}
              helpText="Only letters, numbers, and spaces allowed"
            >
              <TextInput
                {...form.getFieldProps('teamName')}
                placeholder="Enter team name"
                maxLength={50}
              />
            </FormField>

            <FormField
              label="Number of Members"
              required
              error={form.errors.members}
              helpText={form.values.status === 'playing' ? 'Playing teams need at least 2 members' : undefined}
            >
              <NumberInput
                {...form.getFieldProps('members')}
                min={1}
                max={10}
              />
            </FormField>

            <FormField
              label="Team Status"
              required
              error={form.errors.status}
            >
              <Select
                {...form.getFieldProps('status')}
                options={statusOptions}
                placeholder="Select status"
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Contact Information"
            description="How to reach the team"
          >
            <FormField
              label="Contact Info"
              error={form.errors.contactInfo}
              helpText={form.values.members > 5 ? 'Required for large teams' : 'Phone, Line ID, etc. (optional)'}
            >
              <TextInput
                {...form.getFieldProps('contactInfo')}
                placeholder="Phone, Line ID, etc."
                maxLength={100}
              />
            </FormField>

            <FormField
              label="Email"
              error={form.errors.email}
              helpText="Optional email address"
            >
              <TextInput
                {...form.getFieldProps('email')}
                type="email"
                placeholder="team@example.com"
              />
            </FormField>
          </FormSection>
        </FormGroup>

        {/* Form Status Display */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Form Status</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Valid:</span>
              <span className={`ml-2 font-medium ${form.isValid ? 'text-green-600' : 'text-red-600'}`}>
                {form.isValid ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Dirty:</span>
              <span className={`ml-2 font-medium ${form.isDirty ? 'text-blue-600' : 'text-gray-500'}`}>
                {form.isDirty ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Errors:</span>
              <span className="ml-2 font-medium text-red-600">
                {Object.values(form.errors).filter(e => e).length}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Submit Count:</span>
              <span className="ml-2 font-medium text-gray-600">
                {form.submitCount}
              </span>
            </div>
          </div>
        </div>

        {/* Error Summary */}
        {Object.values(form.errors).some(e => e) && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="text-sm font-medium text-red-800 mb-2">Please fix the following errors:</h4>
            <ul className="text-sm text-red-700 space-y-1">
              {Object.entries(form.errors)
                .filter(([, error]) => error)
                .map(([field, error]) => (
                  <li key={field}>• {error}</li>
                ))}
            </ul>
          </div>
        )}

        {/* Submit Button */}
        <div className="mt-6 flex justify-end space-x-3">
          <FormButton
            type="button"
            variant="secondary"
            onClick={() => form.reset()}
            disabled={form.isSubmitting}
          >
            Reset
          </FormButton>
          
          <FormButton
            type="submit"
            variant="primary"
            loading={form.isSubmitting}
            loadingText="Submitting..."
            disabled={!form.isValid && form.submitCount > 0}
          >
            Submit Form
          </FormButton>
        </div>
      </form>

      {/* Debug Information */}
      <details className="mt-6">
        <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
          Debug Information
        </summary>
        <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
          {JSON.stringify({
            values: form.values,
            errors: form.errors,
            touched: form.touched,
            isValid: form.isValid,
            isDirty: form.isDirty,
            isSubmitting: form.isSubmitting,
            submitCount: form.submitCount
          }, null, 2)}
        </pre>
      </details>
    </div>
  );
};