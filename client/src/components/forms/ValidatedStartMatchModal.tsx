import React, { useEffect } from 'react';
import { useAdvancedFormValidation } from '../../hooks/useAdvancedFormValidation';
import { CommonValidators } from '../../utils/formValidation';
import { FormField, NumberInput, Select, FormButton, FormGroup, FormSection, RadioGroup } from './FormField';
import { Team } from '../../types';

interface ValidatedStartMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: StartMatchFormData) => Promise<void>;
  selectedTeams: Team[];
  isLoading?: boolean;
}

interface StartMatchFormData {
  targetScore: number;
  matchType: 'regular' | 'champion-return';
}

export const ValidatedStartMatchModal: React.FC<ValidatedStartMatchModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  selectedTeams,
  isLoading = false
}) => {
  // Form validation with cross-field validation
  const form = useAdvancedFormValidation<StartMatchFormData>(
    {
      targetScore: 21,
      matchType: 'regular' as 'regular' | 'champion-return'
    },
    {
      validator: CommonValidators.startMatch,
      sanitize: true,
      validateOnChange: true,
      validateOnBlur: true,
      debounceMs: 300,
      crossFieldValidation: (values) => {
        const errors: Record<string, string> = {};
        
        // Validate target score based on match type
        if (values.matchType === 'champion-return' && values.targetScore < 15) {
          errors.targetScore = 'Champion return matches require at least 15 points';
        }
        
        if (values.matchType === 'regular' && values.targetScore > 50) {
          errors.targetScore = 'Regular matches should not exceed 50 points';
        }

        return errors;
      }
    }
  );

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      form.reset({
        targetScore: 21,
        matchType: 'regular'
      });
    }
  }, [isOpen]);

  const handleSubmit = form.handleSubmit(async (values) => {
    if (selectedTeams.length !== 2) {
      form.setError('targetScore', 'Please select exactly 2 teams to start a match');
      return;
    }

    try {
      await onSubmit(values);
      onClose();
    } catch (error) {
      // Handle submission errors
      if (error instanceof Error) {
        if (error.message.includes('target score')) {
          form.setError('targetScore', error.message);
        } else if (error.message.includes('match type')) {
          form.setError('matchType', error.message);
        } else {
          form.setError('targetScore', 'Failed to start match. Please try again.');
        }
      }
    }
  });

  const handleClose = () => {
    if (!form.isSubmitting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const matchTypeOptions = [
    { 
      value: 'regular', 
      label: 'Regular Match',
      disabled: false
    },
    { 
      value: 'champion-return', 
      label: 'Champion Return',
      disabled: false
    }
  ];

  const targetScoreOptions = [
    { value: 11, label: '11 Points (Quick)' },
    { value: 15, label: '15 Points (Short)' },
    { value: 21, label: '21 Points (Standard)' },
    { value: 25, label: '25 Points (Extended)' },
    { value: 30, label: '30 Points (Long)' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Start New Match</h3>
            <button
              onClick={handleClose}
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
              Please fix the errors below before starting the match
            </div>
          )}
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <FormGroup>
            {/* Selected Teams Section */}
            <FormSection
              title="Selected Teams"
              description="Teams that will participate in this match"
            >
              {selectedTeams.length === 2 ? (
                <div className="space-y-3">
                  {selectedTeams.map((team, index) => (
                    <div key={team.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full text-sm font-medium text-blue-800">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{team.name}</div>
                          <div className="text-sm text-gray-600">
                            {team.members} members • {team.wins} wins
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Team {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center text-yellow-800">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-sm font-medium">
                      {selectedTeams.length === 0 
                        ? 'No teams selected. Please select 2 teams from the queue.'
                        : `${selectedTeams.length} team(s) selected. Please select exactly 2 teams.`
                      }
                    </span>
                  </div>
                </div>
              )}
            </FormSection>

            {/* Match Settings Section */}
            <FormSection
              title="Match Settings"
              description="Configure the match parameters"
            >
              {/* Match Type */}
              <FormField
                label="Match Type"
                required
                error={form.errors.matchType}
                helpText="Choose the type of match to play"
              >
                <RadioGroup
                  name="matchType"
                  options={matchTypeOptions}
                  value={form.values.matchType}
                  onChange={(value) => form.setValue('matchType', value as 'regular' | 'champion-return')}
                  error={form.errors.matchType}
                />
              </FormField>

              {/* Target Score */}
              <FormField
                label="Target Score"
                required
                error={form.errors.targetScore}
                helpText={
                  form.values.matchType === 'champion-return' 
                    ? 'Champion return matches require at least 15 points'
                    : 'First team to reach this score wins'
                }
              >
                <div className="space-y-3">
                  {/* Quick Select Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {targetScoreOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => form.setValue('targetScore', option.value)}
                        disabled={
                          form.isSubmitting || 
                          (form.values.matchType === 'champion-return' && option.value < 15)
                        }
                        className={`px-3 py-1 text-sm rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          form.values.targetScore === option.value
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  
                  {/* Custom Input */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Custom Score:</label>
                    <NumberInput
                      {...form.getFieldProps('targetScore')}
                      min={form.values.matchType === 'champion-return' ? 15 : 1}
                      max={100}
                      disabled={form.isSubmitting}
                      placeholder="Enter custom target score"
                    />
                  </div>
                </div>
              </FormField>
            </FormSection>

            {/* Match Preview */}
            {selectedTeams.length === 2 && form.isValid && (
              <FormSection
                title="Match Preview"
                description="Review the match details before starting"
              >
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-800 mb-2">
                      {selectedTeams[0].name} vs {selectedTeams[1].name}
                    </div>
                    <div className="text-sm text-green-700">
                      {form.values.matchType === 'champion-return' ? 'Champion Return' : 'Regular Match'} • 
                      First to {form.values.targetScore} points
                    </div>
                  </div>
                </div>
              </FormSection>
            )}
          </FormGroup>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-6">
            <FormButton
              type="submit"
              variant="success"
              loading={form.isSubmitting || isLoading}
              loadingText="Starting Match..."
              disabled={selectedTeams.length !== 2 || (!form.isValid && form.submitCount > 0)}
              className="flex-1"
            >
              Start Match
            </FormButton>
            
            <FormButton
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={form.isSubmitting || isLoading}
            >
              Cancel
            </FormButton>
          </div>

          {/* Form Status */}
          {form.isDirty && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center text-blue-800">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">
                  {form.isValid 
                    ? 'Match configuration is valid and ready to start'
                    : 'Please complete the match configuration'
                  }
                </span>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};