import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFormValidation } from '../hooks/useFormValidation';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import { CommonValidators } from '../utils/formValidation';
import { FormField, TextInput } from './forms/FormField';
import { LoadingSpinner } from './LoadingSpinner';

interface AdminLoginFormProps {
  onClose?: () => void;
}

interface LoginFormData {
  username: string;
  password: string;
}

export const AdminLoginForm: React.FC<AdminLoginFormProps> = ({ onClose }) => {
  const [showPassword, setShowPassword] = useState(false);
  const { state, login, clearError } = useAuth();
  const { handleError } = useApiErrorHandler();

  // Enhanced form validation
  const form = useFormValidation<LoginFormData>(
    {
      username: '',
      password: ''
    },
    {
      validator: CommonValidators.adminLogin,
      sanitize: true,
      validateOnChange: false,
      validateOnBlur: true
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validationResult = form.validateAll();
    if (!validationResult.isValid) {
      return;
    }

    form.setSubmitting(true);
    clearError();

    try {
      await login(form.values.username.trim(), form.values.password);
      
      // Close modal on successful login
      if (!state.error && state.isAuthenticated && onClose) {
        onClose();
      }
    } catch (error) {
      handleError(error, 'Admin Login');
    } finally {
      form.setSubmitting(false);
    }
  };

  const handleInputChange = () => {
    if (state.error) {
      clearError();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔐</div>
          <h2 className="text-2xl font-bold text-gray-800">Admin Login</h2>
          <p className="text-gray-600 mt-1">Enter your admin credentials</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label="ชื่อผู้ใช้ / Username"
            required
            error={form.errors.username}
          >
            <TextInput
              {...form.getFieldProps('username')}
              placeholder="ใส่ชื่อผู้ใช้"
              disabled={state.isLoading || form.isSubmitting}
              onChange={(e) => {
                form.handleChange('username', e.target.value);
                handleInputChange();
              }}
            />
          </FormField>

          <FormField
            label="รหัสผ่าน / Password"
            required
            error={form.errors.password}
          >
            <div className="relative">
              <TextInput
                {...form.getFieldProps('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="ใส่รหัสผ่าน"
                disabled={state.isLoading || form.isSubmitting}
                className="pr-10"
                onChange={(e) => {
                  form.handleChange('password', e.target.value);
                  handleInputChange();
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                disabled={state.isLoading || form.isSubmitting}
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </FormField>

          {state.error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{state.error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={state.isLoading || form.isSubmitting || !form.isValid}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {state.isLoading || form.isSubmitting ? (
                <div className="flex items-center justify-center">
                  <LoadingSpinner size="sm" color="white" className="mr-2" />
                  กำลังเข้าสู่ระบบ...
                </div>
              ) : (
                'เข้าสู่ระบบ / Login'
              )}
            </button>
            
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={state.isLoading || form.isSubmitting}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ยกเลิก / Cancel
              </button>
            )}
          </div>
        </form>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Admin access is required to manage teams and matches
          </p>
        </div>
      </div>
    </div>
  );
};