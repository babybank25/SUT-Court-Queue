import React, { useState, useEffect } from 'react';
import { useSocketContext } from '../contexts/SocketContext';
import { useRealtimeQueue } from '../hooks/useRealtimeQueue';
import { useToast } from '../contexts/ToastContext';
import { useFormValidation } from '../hooks/useFormValidation';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import { CommonValidators } from '../utils/formValidation';
import { FormField, TextInput, NumberInput } from './forms/FormField';
import { LoadingSpinner } from './LoadingSpinner';
import { validateJoinQueueForm, sanitizeJoinQueueData, formatApiError, estimateWaitTime } from '../utils/validateJoinQueue';

interface JoinQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (teamData: { name: string; members: number; position: number }) => void;
}

interface FormData {
  name: string;
  members: number;
  contactInfo: string;
}

export const JoinQueueModal: React.FC<JoinQueueModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { isConnected, emit } = useSocketContext();
  const { isQueueFull, queueData } = useRealtimeQueue();
  const { addToast } = useToast();
  const { handleError, handleSuccess } = useApiErrorHandler();
  
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [generalError, setGeneralError] = useState<string>('');

  // Enhanced form validation with cross-field validation
  const form = useFormValidation<FormData>(
    {
      name: '',
      members: 2,
      contactInfo: ''
    },
    {
      validator: CommonValidators.joinQueue,
      sanitize: true,
      validateOnChange: true,
      validateOnBlur: true
    }
  );

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      form.reset({
        name: '',
        members: 2,
        contactInfo: ''
      });
      setSubmitSuccess(false);
      setGeneralError('');
    }
  }, [isOpen, form]);

  // Additional validation for existing team names
  const validateTeamName = (name: string): string | null => {
    const existingTeamNames = queueData.teams?.map(team => team.name.toLowerCase()) || [];
    if (existingTeamNames.includes(name.toLowerCase())) {
      return 'ชื่อทีมนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น';
    }
    return null;
  };

  // Handle form submission with enhanced validation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous general error
    setGeneralError('');
    
    // Validate form
    const validationResult = form.validateAll();
    
    // Additional team name validation
    const teamNameError = validateTeamName(form.values.name);
    if (teamNameError) {
      form.setErrors({ name: teamNameError });
      return;
    }
    
    if (!validationResult.isValid) {
      // Mark all fields as touched to show validation errors
      Object.keys(form.values).forEach(field => {
        form.handleBlur(field);
      });
      return;
    }

    // Pre-submission validations
    if (isQueueFull) {
      setGeneralError('คิวเต็มแล้ว กรุณารอสักครู่แล้วลองใหม่');
      return;
    }

    if (!isConnected) {
      setGeneralError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่อ');
      return;
    }

    form.setSubmitting(true);

    try {
      // Submit via API with sanitized data
      const sanitizedData = {
        name: form.values.name.trim(),
        members: form.values.members,
        contactInfo: form.values.contactInfo.trim() || undefined
      };

      const response = await fetch('/api/queue/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sanitizedData),
      });

      const result = await response.json();

      if (result.success) {
        setSubmitSuccess(true);
        
        // Show success toast with estimated wait time
        const waitTime = estimateWaitTime(result.data.position);
        handleSuccess(
          `ทีม "${result.data.team.name}" อยู่ในตำแหน่งที่ ${result.data.position} เวลารอโดยประมาณ: ${waitTime}`,
          'เข้าคิวสำเร็จ!'
        );
        
        // Call success callback if provided
        if (onSuccess) {
          onSuccess({
            name: result.data.team.name,
            members: result.data.team.members,
            position: result.data.position
          });
        }

        // Close modal after a short delay to show success message
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        // Handle API errors with improved error mapping
        if (result.error?.code === 'TEAM_NAME_EXISTS') {
          form.setErrors({ name: 'ชื่อทีมนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น' });
        } else if (result.error?.code === 'QUEUE_FULL') {
          setGeneralError('คิวเต็มแล้ว');
        } else if (result.error?.code === 'VALIDATION_ERROR') {
          // Handle server-side validation errors
          if (result.error.validationErrors) {
            form.setErrors(result.error.validationErrors);
          } else {
            setGeneralError(result.error.message || 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่');
          }
        } else if (result.error?.code === 'RATE_LIMIT_EXCEEDED') {
          setGeneralError('คำขอเร็วเกินไป กรุณารอสักครู่แล้วลองใหม่');
        } else {
          handleError(result.error, 'Join Queue');
        }
      }
    } catch (error) {
      // Enhanced error handling for network issues
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setGeneralError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
      } else {
        handleError(error, 'Join Queue Network');
      }
    } finally {
      form.setSubmitting(false);
    }
  };



  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Join Queue</h2>
          <button
            onClick={onClose}
            disabled={form.isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 p-1 touch-manipulation"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {submitSuccess ? (
            // Success state
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🎉</div>
              <h3 className="text-lg font-semibold text-green-800 mb-2">Successfully Joined!</h3>
              <p className="text-gray-600">
                ทีม "{form.values.name}" ได้เข้าคิวเรียบร้อยแล้ว
              </p>
              <p className="text-sm text-gray-500 mt-2">
                This window will close automatically...
              </p>
            </div>
          ) : (
            // Form state
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Queue status warning */}
              {isQueueFull && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-yellow-800">
                    <span className="text-sm">⚠️</span>
                    <span className="text-sm font-medium">Queue is currently full</span>
                  </div>
                </div>
              )}

              {/* Connection status warning */}
              {!isConnected && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-red-800">
                    <span className="text-sm">🔌</span>
                    <span className="text-sm font-medium">Not connected to server</span>
                  </div>
                </div>
              )}

              {/* General error */}
              {generalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{generalError}</p>
                </div>
              )}

              {/* Team Name */}
              <FormField
                label="ชื่อทีม / Team Name"
                required
                error={form.errors.name}
                helpText="ใช้ได้เฉพาะตัวอักษร ตัวเลข และช่องว่าง"
              >
                <TextInput
                  {...form.getFieldProps('name')}
                  placeholder="ใส่ชื่อทีมของคุณ"
                  maxLength={50}
                  disabled={form.isSubmitting}
                />
              </FormField>

              {/* Number of Players */}
              <FormField
                label="จำนวนผู้เล่น / Number of Players"
                required
                error={form.errors.members}
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

              {/* Queue Info */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Current queue size:</span>
                    <span className="font-medium">{queueData.totalTeams || 0} teams</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Available slots:</span>
                    <span className="font-medium">{queueData.availableSlots || 0} slots</span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={form.isSubmitting}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 text-sm sm:text-base min-h-[44px] touch-manipulation"
                >
                  ยกเลิก / Cancel
                </button>
                <button
                  type="submit"
                  disabled={form.isSubmitting || isQueueFull || !isConnected}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm sm:text-base min-h-[44px] touch-manipulation"
                >
                  {form.isSubmitting ? (
                    <>
                      <LoadingSpinner size="sm" color="white" className="mr-2" />
                      <span className="hidden sm:inline">กำลังเข้าคิว...</span>
                      <span className="sm:hidden">Joining...</span>
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">เข้าคิว / Join Queue</span>
                      <span className="sm:hidden">Join Queue</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};