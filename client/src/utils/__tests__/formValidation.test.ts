import { describe, it, expect } from 'vitest';
import {
  validateRequired,
  validateEmail,
  validateMinLength,
  validateMaxLength,
  validateMin,
  validateMax,
  validatePattern,
  validateJoinQueueForm,
} from '../formValidation';

describe('Form Validation Utils', () => {
  describe('validateRequired', () => {
    it('should return error for empty string', () => {
      expect(validateRequired('')).toBe('This field is required');
    });

    it('should return error for whitespace only', () => {
      expect(validateRequired('   ')).toBe('This field is required');
    });

    it('should return null for valid string', () => {
      expect(validateRequired('valid')).toBeNull();
    });

    it('should return error for null/undefined', () => {
      expect(validateRequired(null)).toBe('This field is required');
      expect(validateRequired(undefined)).toBe('This field is required');
    });

    it('should return error for zero', () => {
      expect(validateRequired(0)).toBe('This field is required');
    });

    it('should return null for valid number', () => {
      expect(validateRequired(5)).toBeNull();
    });
  });

  describe('validateEmail', () => {
    it('should return null for valid emails', () => {
      expect(validateEmail('test@example.com')).toBeNull();
      expect(validateEmail('user.name@domain.co.uk')).toBeNull();
      expect(validateEmail('user+tag@example.org')).toBeNull();
    });

    it('should return error for invalid emails', () => {
      expect(validateEmail('invalid')).toBe('Please enter a valid email address');
      expect(validateEmail('invalid@')).toBe('Please enter a valid email address');
      expect(validateEmail('@domain.com')).toBe('Please enter a valid email address');
      expect(validateEmail('user@')).toBe('Please enter a valid email address');
      expect(validateEmail('user@domain')).toBe('Please enter a valid email address');
    });

    it('should return null for empty string when not required', () => {
      expect(validateEmail('')).toBeNull();
    });
  });

  describe('validateMinLength', () => {
    it('should return error for strings shorter than minimum', () => {
      expect(validateMinLength('ab', 3)).toBe('Must be at least 3 characters');
    });

    it('should return null for strings meeting minimum', () => {
      expect(validateMinLength('abc', 3)).toBeNull();
      expect(validateMinLength('abcd', 3)).toBeNull();
    });

    it('should handle empty strings', () => {
      expect(validateMinLength('', 3)).toBe('Must be at least 3 characters');
    });
  });

  describe('validateMaxLength', () => {
    it('should return error for strings longer than maximum', () => {
      expect(validateMaxLength('abcdef', 5)).toBe('Must be no more than 5 characters');
    });

    it('should return null for strings within maximum', () => {
      expect(validateMaxLength('abc', 5)).toBeNull();
      expect(validateMaxLength('abcde', 5)).toBeNull();
    });

    it('should handle empty strings', () => {
      expect(validateMaxLength('', 5)).toBeNull();
    });
  });

  describe('validateMin', () => {
    it('should return error for numbers below minimum', () => {
      expect(validateMin(2, 3)).toBe('Must be at least 3');
    });

    it('should return null for numbers meeting minimum', () => {
      expect(validateMin(3, 3)).toBeNull();
      expect(validateMin(5, 3)).toBeNull();
    });

    it('should handle zero', () => {
      expect(validateMin(0, 1)).toBe('Must be at least 1');
    });

    it('should handle negative numbers', () => {
      expect(validateMin(-5, 0)).toBe('Must be at least 0');
    });
  });

  describe('validateMax', () => {
    it('should return error for numbers above maximum', () => {
      expect(validateMax(6, 5)).toBe('Must be no more than 5');
    });

    it('should return null for numbers within maximum', () => {
      expect(validateMax(3, 5)).toBeNull();
      expect(validateMax(5, 5)).toBeNull();
    });

    it('should handle zero', () => {
      expect(validateMax(0, 5)).toBeNull();
    });

    it('should handle negative numbers', () => {
      expect(validateMax(-1, 0)).toBeNull();
    });
  });

  describe('validatePattern', () => {
    const phonePattern = /^\d{3}-\d{3}-\d{4}$/;

    it('should return null for matching patterns', () => {
      expect(validatePattern('123-456-7890', phonePattern)).toBeNull();
    });

    it('should return error for non-matching patterns', () => {
      expect(validatePattern('1234567890', phonePattern)).toBe('Invalid format');
      expect(validatePattern('123-45-6789', phonePattern)).toBe('Invalid format');
    });

    it('should return null for empty strings', () => {
      expect(validatePattern('', phonePattern)).toBeNull();
    });

    it('should handle custom error messages', () => {
      expect(validatePattern('invalid', phonePattern, 'Invalid phone number'))
        .toBe('Invalid phone number');
    });
  });

  describe('validateJoinQueueForm', () => {
    const validForm = {
      name: 'Test Team',
      members: 5,
      contactInfo: 'test@example.com',
    };

    it('should return no errors for valid form', () => {
      const errors = validateJoinQueueForm(validForm);
      expect(errors).toEqual({});
    });

    it('should validate team name', () => {
      const errors = validateJoinQueueForm({ ...validForm, name: '' });
      expect(errors.name).toBe('Team name is required');
    });

    it('should validate team name length', () => {
      const shortName = validateJoinQueueForm({ ...validForm, name: 'A' });
      expect(shortName.name).toBe('Team name must be at least 2 characters');

      const longName = validateJoinQueueForm({ 
        ...validForm, 
        name: 'A'.repeat(51) 
      });
      expect(longName.name).toBe('Team name must be no more than 50 characters');
    });

    it('should validate member count', () => {
      const noMembers = validateJoinQueueForm({ ...validForm, members: 0 });
      expect(noMembers.members).toBe('Must have at least 1 player');

      const tooManyMembers = validateJoinQueueForm({ ...validForm, members: 11 });
      expect(tooManyMembers.members).toBe('Cannot have more than 10 players');
    });

    it('should validate contact info when provided', () => {
      const invalidEmail = validateJoinQueueForm({ 
        ...validForm, 
        contactInfo: 'invalid-email' 
      });
      expect(invalidEmail.contactInfo).toBe('Please enter a valid email address');
    });

    it('should allow empty contact info', () => {
      const errors = validateJoinQueueForm({ ...validForm, contactInfo: '' });
      expect(errors.contactInfo).toBeUndefined();
    });

    it('should return multiple errors', () => {
      const invalidForm = {
        name: '',
        members: 0,
        contactInfo: 'invalid-email',
      };

      const errors = validateJoinQueueForm(invalidForm);
      expect(errors.name).toBe('Team name is required');
      expect(errors.members).toBe('Must have at least 1 player');
      expect(errors.contactInfo).toBe('Please enter a valid email address');
    });

    it('should handle special characters in team name', () => {
      const specialChars = validateJoinQueueForm({ 
        ...validForm, 
        name: 'Team @#$%' 
      });
      expect(specialChars.name).toBeUndefined();
    });

    it('should handle unicode characters in team name', () => {
      const unicode = validateJoinQueueForm({ 
        ...validForm, 
        name: 'Team 中文' 
      });
      expect(unicode.name).toBeUndefined();
    });

    it('should validate edge case member counts', () => {
      const onePlayer = validateJoinQueueForm({ ...validForm, members: 1 });
      expect(onePlayer.members).toBeUndefined();

      const tenPlayers = validateJoinQueueForm({ ...validForm, members: 10 });
      expect(tenPlayers.members).toBeUndefined();
    });

    it('should handle various email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com',
      ];

      validEmails.forEach(email => {
        const errors = validateJoinQueueForm({ ...validForm, contactInfo: email });
        expect(errors.contactInfo).toBeUndefined();
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid',
        'invalid@',
        '@domain.com',
        'user@',
        'user@domain',
        'user..name@domain.com',
        'user@domain..com',
      ];

      invalidEmails.forEach(email => {
        const errors = validateJoinQueueForm({ ...validForm, contactInfo: email });
        expect(errors.contactInfo).toBe('Please enter a valid email address');
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle null/undefined inputs gracefully', () => {
      expect(validateMinLength(null as any, 3)).toBe('Must be at least 3 characters');
      expect(validateMaxLength(undefined as any, 5)).toBeNull();
      expect(validateMin(null as any, 3)).toBe('Must be at least 3');
      expect(validateMax(undefined as any, 5)).toBeNull();
    });

    it('should handle non-string inputs for string validators', () => {
      expect(validateMinLength(123 as any, 3)).toBe('Must be at least 3 characters');
      expect(validateEmail(123 as any)).toBe('Please enter a valid email address');
    });

    it('should handle non-number inputs for number validators', () => {
      expect(validateMin('abc' as any, 3)).toBe('Must be at least 3');
      expect(validateMax('xyz' as any, 5)).toBeNull();
    });
  });
});