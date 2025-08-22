import React, { useEffect } from 'react';
import { useAdvancedFormValidation } from '../../hooks/useAdvancedFormValidation';
import { CommonValidators } from '../../utils/formValidation';
import { FormField, TextInput, NumberInput, Select, FormButton, FormGroup } from './FormField';
import { useAuthApi } from '../../hooks/useAuthApi';
import { useToast } from '../../contexts/ToastContext';
import { Team } from '../../types';

interface ValidatedTeamEditModalProps {
  team: Team | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (team: Team) => void;
  existingTeamNames?: string[];
}

interface TeamFormData {
  name: string;
  members: number;
  contactInfo: string;
  status: Team['status'];
  wins: number;
}

export const ValidatedTeamEditModal: React.FC<ValidatedTeamEditModalProps> = ({
  team,
  isOpen,
  onClose,
  onSave,
  existingTeamNames = []
}) => {
  const { put } = useAuthApi();
  const { showToast } = useToast();

  // Form validation with cross-field validation
  const form = useAdvancedFormValidation<TeamFormData>(
    {
      name: '',
      members: 2,
      contactInfo: '',
      status: 'waiting' as Team['status'],
      wins: 0,
    },
    {
      validator: CommonValidators.teamEdit,
      sanitize: true,
      validateOnChange: true,
      validateOnBlur: true,
      debounceMs: 500,
      crossFieldValidation: (values) => {
        const errors: Record<string, string> = {};
        
        // Check for duplicate team names (excluding current team)
        if (values.name && team) {
          const duplicateName = existingTeamNames
            .filter(name => name.toLowerCase() !== team.name.toLowerCase())
            .some(name => name.toLowerCase() === values.name.toLowerCase());
          
          if (duplicateName) {
            errors.name = 'ชื่อทีมนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น';
          }
        }

        // Validate members based on status
        if (values.status === 'playing' && values.members < 2) {
          errors.members = 'ทีมที่กำลังเล่นต้องมีผู้เล่นอย่างน้อย 2 คน';
        }

        // Validate wins consistency
        if (values.wins > 0 && values.status === 'waiting' && values.members < 2) {
          errors.wins = 'ทีมที่มีคะแนนชนะต้องมีผู้เล่นอย่างน้อย 2 คน';
        }

        return errors;
      }
    }
  );

  // Initialize form when team changes
  useEffect(() => {
    if (team && isOpen) {
      form.setValues({
        name: team.name,
        members: team.members,
        contactInfo: team.contactInfo || '',
        status: team.status,
        wins: team.wins,
      });
    }
  }, [team, isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [isOpen]);

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!team) return;

    try {
      const response = await put(`/api/admin/teams/${team.id}`, values);
      
      if (response.success && response.data) {
        onSave(response.data.team);
        showToast('success', 'Team Updated', 'Team information has been updated successfully');
        onClose();
      } else {
        // Handle API validation errors
        if (response.error?.validationErrors) {
          form.setErrors(response.error.validationErrors);
        } else {
          showToast('error', 'Update Failed', response.error?.message || 'Failed to update team');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update team';
      showToast('error', 'Update Failed', errorMessage);
      
      // Handle network or other errors
      if (err instanceof Error && err.message.includes('validation')) {
        form.setError('name', 'Validation error occurred');
      }
    }
  });

  if (!isOpen || !team) return null;

  const statusOptions = [
    { value: 'waiting', label: 'Waiting' },
    { value: 'playing', label: 'Playing' },
    { value: 'cooldown', label: 'Cooldown' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Edit Team</h3>
            <button
              onClick={onClose}
              disabled={form.isSubmitting}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {form.submitCount > 0 && !form.isValid && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
              Please fix the errors below before submitting
            </div>
          )}
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <FormGroup>
            {/* Team Name */}
            <FormField
              label="ชื่อทีม / Team Name"
              required
              error={form.errors.name}
              helpText="ใช้ได้เฉพาะตัวอักษร ตัวเลข และช่องว่าง"
            >
              <TextInput
                {...form.getFieldProps('name')}
                placeholder="ใส่ชื่อทีม"
                maxLength={50}
                disabled={form.isSubmitting}
              />
            </FormField>

            {/* Number of Members */}
            <FormField
              label="จำนวนผู้เล่น / Number of Members"
              required
              error={form.errors.members}
              helpText={form.values.status === 'playing' ? 'ทีมที่กำลังเล่นต้องมีผู้เล่นอย่างน้อย 2 คน' : undefined}
            >
              <NumberInput
                {...form.getFieldProps('members')}
                min={1}
                max={10}
                disabled={form.isSubmitting}
              />
            </FormField>

            {/* Contact Info */}
            <FormField
              label="ข้อมูลติดต่อ / Contact Info"
              error={form.errors.contactInfo}
              helpText="เบอร์โทร Line ID หรือข้อมูลติดต่ออื่น ๆ (ไม่บังคับ)"
            >
              <TextInput
                {...form.getFieldProps('contactInfo')}
                placeholder="เบอร์โทร, Line ID, ฯลฯ"
                maxLength={100}
                disabled={form.isSubmitting}
              />
            </FormField>

            {/* Status */}
            <FormField
              label="สถานะ / Status"
              required
              error={form.errors.status}
            >
              <Select
                {...form.getFieldProps('status')}
                options={statusOptions}
                disabled={form.isSubmitting}
              />
            </FormField>

            {/* Wins */}
            <FormField
              label="จำนวนชนะ / Wins"
              required
              error={form.errors.wins}
              helpText="จำนวนครั้งที่ทีมนี้ชนะ"
            >
              <NumberInput
                {...form.getFieldProps('wins')}
                min={0}
                max={9999}
                disabled={form.isSubmitting}
              />
            </FormField>
          </FormGroup>

          {/* Form Status */}
          {form.isDirty && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center text-blue-800">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">
                  Form has unsaved changes
                  {form.isValid ? ' - Ready to save' : ' - Please fix errors first'}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-6">
            <FormButton
              type="submit"
              variant="primary"
              loading={form.isSubmitting}
              loadingText="Saving..."
              disabled={!form.isValid && form.submitCount > 0}
              className="flex-1"
            >
              Save Changes
            </FormButton>
            
            <FormButton
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={form.isSubmitting}
            >
              Cancel
            </FormButton>
          </div>

          {/* Debug Info (only in development) */}
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4 text-xs text-gray-500">
              <summary className="cursor-pointer">Debug Info</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                {JSON.stringify({
                  isValid: form.isValid,
                  isDirty: form.isDirty,
                  submitCount: form.submitCount,
                  errors: form.errors,
                  touched: form.touched
                }, null, 2)}
              </pre>
            </details>
          )}
        </form>
      </div>
    </div>
  );
};