export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
  message?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  fieldErrors: Record<string, string>;
}

export class FormValidator {
  private rules: Record<string, ValidationRule> = {};
  private customMessages: Record<string, Record<string, string>> = {};

  constructor(rules: Record<string, ValidationRule> = {}) {
    this.rules = rules;
  }

  /**
   * Set validation rules for fields
   */
  setRules(rules: Record<string, ValidationRule>): void {
    this.rules = { ...this.rules, ...rules };
  }

  /**
   * Set custom error messages
   */
  setMessages(field: string, messages: Record<string, string>): void {
    this.customMessages[field] = messages;
  }

  /**
   * Validate a single field
   */
  validateField(field: string, value: any): string | null {
    const rule = this.rules[field];
    if (!rule) return null;

    // Required validation
    if (rule.required && (value === null || value === undefined || value === '')) {
      return this.getMessage(field, 'required', `${field} is required`);
    }

    // Skip other validations if value is empty and not required
    if (!rule.required && (value === null || value === undefined || value === '')) {
      return null;
    }

    // String validations
    if (typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        return this.getMessage(field, 'minLength', `${field} must be at least ${rule.minLength} characters`);
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        return this.getMessage(field, 'maxLength', `${field} must be no more than ${rule.maxLength} characters`);
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        return this.getMessage(field, 'pattern', `${field} format is invalid`);
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        return this.getMessage(field, 'min', `${field} must be at least ${rule.min}`);
      }
      if (rule.max !== undefined && value > rule.max) {
        return this.getMessage(field, 'max', `${field} must be no more than ${rule.max}`);
      }
    }

    // Custom validation
    if (rule.custom) {
      const customError = rule.custom(value);
      if (customError) return customError;
    }

    return null;
  }

  /**
   * Validate entire form
   */
  validate(data: Record<string, any>): ValidationResult {
    const errors: ValidationError[] = [];
    const fieldErrors: Record<string, string> = {};

    // Validate each field with rules
    Object.keys(this.rules).forEach(field => {
      const error = this.validateField(field, data[field]);
      if (error) {
        errors.push({ field, message: error });
        fieldErrors[field] = error;
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      fieldErrors
    };
  }

  /**
   * Get custom message or default
   */
  private getMessage(field: string, type: string, defaultMessage: string): string {
    return this.customMessages[field]?.[type] || this.rules[field]?.message || defaultMessage;
  }
}

/**
 * Input sanitization utilities
 */
export class InputSanitizer {
  /**
   * Sanitize string input
   */
  static sanitizeString(value: string): string {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/\s+/g, ' ');
  }

  /**
   * Sanitize team name
   */
  static sanitizeTeamName(value: string): string {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/[<>\"'&]/g, '').substring(0, 50);
  }

  /**
   * Sanitize contact info
   */
  static sanitizeContactInfo(value: string): string {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/[<>\"']/g, '').substring(0, 100);
  }

  /**
   * Sanitize number input
   */
  static sanitizeNumber(value: any, min?: number, max?: number): number {
    const num = parseInt(value, 10);
    if (isNaN(num)) return min || 0;
    
    let result = num;
    if (min !== undefined) result = Math.max(result, min);
    if (max !== undefined) result = Math.min(result, max);
    
    return result;
  }

  /**
   * Sanitize float number input
   */
  static sanitizeFloat(value: any, min?: number, max?: number, decimals: number = 2): number {
    const num = parseFloat(value);
    if (isNaN(num)) return min || 0;
    
    let result = num;
    if (min !== undefined) result = Math.max(result, min);
    if (max !== undefined) result = Math.min(result, max);
    
    return parseFloat(result.toFixed(decimals));
  }

  /**
   * Sanitize username input
   */
  static sanitizeUsername(value: string): string {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '').substring(0, 50);
  }

  /**
   * Sanitize password input (no modification, just validation)
   */
  static sanitizePassword(value: string): string {
    if (typeof value !== 'string') return '';
    return value; // Don't modify passwords, just return as-is
  }

  /**
   * Remove HTML tags and dangerous characters
   */
  static stripHtml(value: string): string {
    if (typeof value !== 'string') return '';
    return value.replace(/<[^>]*>/g, '').replace(/[<>\"'&]/g, '');
  }

  /**
   * Sanitize email input
   */
  static sanitizeEmail(value: string): string {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase().substring(0, 100);
  }

  /**
   * Sanitize phone number input
   */
  static sanitizePhone(value: string): string {
    if (typeof value !== 'string') return '';
    return value.replace(/[^0-9+()-\s]/g, '').trim().substring(0, 20);
  }

  /**
   * Sanitize URL input
   */
  static sanitizeUrl(value: string): string {
    if (typeof value !== 'string') return '';
    return value.trim().substring(0, 200);
  }
}

/**
 * Pre-configured validators for common use cases
 */
export const CommonValidators = {
  teamName: new FormValidator({
    name: {
      required: true,
      minLength: 1,
      maxLength: 50,
      pattern: /^[a-zA-Z0-9\s\u0E00-\u0E7F]+$/,
      message: 'ชื่อทีมต้องมี 1-50 ตัวอักษร และใช้ได้เฉพาะตัวอักษร ตัวเลข และช่องว่าง'
    }
  }),

  joinQueue: new FormValidator({
    name: {
      required: true,
      minLength: 1,
      maxLength: 50,
      pattern: /^[a-zA-Z0-9\s\u0E00-\u0E7F]+$/,
      message: 'ชื่อทีมต้องมี 1-50 ตัวอักษร และใช้ได้เฉพาะตัวอักษร ตัวเลข และช่องว่าง'
    },
    members: {
      required: true,
      min: 1,
      max: 10,
      message: 'จำนวนผู้เล่นต้องอยู่ระหว่าง 1-10 คน'
    },
    contactInfo: {
      required: false,
      maxLength: 100,
      message: 'ข้อมูลติดต่อต้องไม่เกิน 100 ตัวอักษร'
    }
  }),

  adminLogin: new FormValidator({
    username: {
      required: true,
      minLength: 3,
      maxLength: 50,
      message: 'ชื่อผู้ใช้ต้องมี 3-50 ตัวอักษร'
    },
    password: {
      required: true,
      minLength: 6,
      message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'
    }
  }),

  teamEdit: new FormValidator({
    name: {
      required: true,
      minLength: 1,
      maxLength: 50,
      pattern: /^[a-zA-Z0-9\s\u0E00-\u0E7F]+$/,
      message: 'ชื่อทีมต้องมี 1-50 ตัวอักษร และใช้ได้เฉพาะตัวอักษร ตัวเลข และช่องว่าง'
    },
    members: {
      required: true,
      min: 1,
      max: 10,
      message: 'จำนวนผู้เล่นต้องอยู่ระหว่าง 1-10 คน'
    },
    contactInfo: {
      required: false,
      maxLength: 100,
      message: 'ข้อมูลติดต่อต้องไม่เกิน 100 ตัวอักษร'
    },
    wins: {
      required: true,
      min: 0,
      max: 9999,
      message: 'จำนวนชนะต้องอยู่ระหว่าง 0-9999'
    }
  }),

  startMatch: new FormValidator({
    targetScore: {
      required: true,
      min: 1,
      max: 100,
      message: 'คะแนนเป้าหมายต้องอยู่ระหว่าง 1-100'
    },
    matchType: {
      required: true,
      custom: (value) => {
        if (!['regular', 'champion-return'].includes(value)) {
          return 'ประเภทการแข่งขันไม่ถูกต้อง';
        }
        return null;
      }
    }
  }),

  matchScore: new FormValidator({
    score1: {
      required: true,
      min: 0,
      max: 999,
      message: 'คะแนนต้องอยู่ระหว่าง 0-999'
    },
    score2: {
      required: true,
      min: 0,
      max: 999,
      message: 'คะแนนต้องอยู่ระหว่าง 0-999'
    }
  }),

  queueSettings: new FormValidator({
    maxSize: {
      required: true,
      min: 1,
      max: 50,
      message: 'ขนาดคิวสูงสุดต้องอยู่ระหว่าง 1-50'
    }
  }),

  email: new FormValidator({
    email: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      maxLength: 100,
      message: 'รูปแบบอีเมลไม่ถูกต้อง'
    }
  }),

  phone: new FormValidator({
    phone: {
      required: false,
      pattern: /^[\d+()-\s]{10,20}$/,
      message: 'รูปแบบเบอร์โทรไม่ถูกต้อง'
    }
  }),

  url: new FormValidator({
    url: {
      required: false,
      pattern: /^https?:\/\/.+/,
      maxLength: 200,
      message: 'รูปแบบ URL ไม่ถูกต้อง'
    }
  })
};

/**
 * Thai language error messages
 */
CommonValidators.teamName.setMessages('name', {
  required: 'กรุณาใส่ชื่อทีม',
  minLength: 'ชื่อทีมต้องมีอย่างน้อย 1 ตัวอักษร',
  maxLength: 'ชื่อทีมต้องไม่เกิน 50 ตัวอักษร',
  pattern: 'ชื่อทีมใช้ได้เฉพาะตัวอักษร ตัวเลข และช่องว่าง'
});

CommonValidators.joinQueue.setMessages('name', {
  required: 'กรุณาใส่ชื่อทีม',
  minLength: 'ชื่อทีมต้องมีอย่างน้อย 1 ตัวอักษร',
  maxLength: 'ชื่อทีมต้องไม่เกิน 50 ตัวอักษร',
  pattern: 'ชื่อทีมใช้ได้เฉพาะตัวอักษร ตัวเลข และช่องว่าง'
});

CommonValidators.joinQueue.setMessages('members', {
  required: 'กรุณาใส่จำนวนผู้เล่น',
  min: 'จำนวนผู้เล่นต้องอย่างน้อย 1 คน',
  max: 'จำนวนผู้เล่นต้องไม่เกิน 10 คน'
});

CommonValidators.joinQueue.setMessages('contactInfo', {
  maxLength: 'ข้อมูลติดต่อต้องไม่เกิน 100 ตัวอักษร'
});

CommonValidators.adminLogin.setMessages('username', {
  required: 'กรุณาใส่ชื่อผู้ใช้',
  minLength: 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร',
  maxLength: 'ชื่อผู้ใช้ต้องไม่เกิน 50 ตัวอักษร'
});

CommonValidators.adminLogin.setMessages('password', {
  required: 'กรุณาใส่รหัสผ่าน',
  minLength: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'
});

CommonValidators.matchScore.setMessages('score1', {
  required: 'กรุณาใส่คะแนนทีม 1',
  min: 'คะแนนต้องไม่ติดลบ',
  max: 'คะแนนต้องไม่เกิน 999'
});

CommonValidators.matchScore.setMessages('score2', {
  required: 'กรุณาใส่คะแนนทีม 2',
  min: 'คะแนนต้องไม่ติดลบ',
  max: 'คะแนนต้องไม่เกิน 999'
});

// Team Edit Messages
CommonValidators.teamEdit.setMessages('name', {
  required: 'กรุณาใส่ชื่อทีม',
  minLength: 'ชื่อทีมต้องมีอย่างน้อย 1 ตัวอักษร',
  maxLength: 'ชื่อทีมต้องไม่เกิน 50 ตัวอักษร',
  pattern: 'ชื่อทีมใช้ได้เฉพาะตัวอักษร ตัวเลข และช่องว่าง'
});

CommonValidators.teamEdit.setMessages('members', {
  required: 'กรุณาใส่จำนวนผู้เล่น',
  min: 'จำนวนผู้เล่นต้องอย่างน้อย 1 คน',
  max: 'จำนวนผู้เล่นต้องไม่เกิน 10 คน'
});

CommonValidators.teamEdit.setMessages('contactInfo', {
  maxLength: 'ข้อมูลติดต่อต้องไม่เกิน 100 ตัวอักษร'
});

CommonValidators.teamEdit.setMessages('wins', {
  required: 'กรุณาใส่จำนวนชนะ',
  min: 'จำนวนชนะต้องไม่ติดลบ',
  max: 'จำนวนชนะต้องไม่เกิน 9999'
});

// Start Match Messages
CommonValidators.startMatch.setMessages('targetScore', {
  required: 'กรุณาใส่คะแนนเป้าหมาย',
  min: 'คะแนนเป้าหมายต้องอย่างน้อย 1',
  max: 'คะแนนเป้าหมายต้องไม่เกิน 100'
});

CommonValidators.startMatch.setMessages('matchType', {
  required: 'กรุณาเลือกประเภทการแข่งขัน'
});

// Queue Settings Messages
CommonValidators.queueSettings.setMessages('maxSize', {
  required: 'กรุณาใส่ขนาดคิวสูงสุด',
  min: 'ขนาดคิวต้องอย่างน้อย 1',
  max: 'ขนาดคิวต้องไม่เกิน 50'
});

// Email Messages
CommonValidators.email.setMessages('email', {
  required: 'กรุณาใส่อีเมล',
  pattern: 'รูปแบบอีเมลไม่ถูกต้อง',
  maxLength: 'อีเมลต้องไม่เกิน 100 ตัวอักษร'
});

// Phone Messages
CommonValidators.phone.setMessages('phone', {
  pattern: 'รูปแบบเบอร์โทรไม่ถูกต้อง (ใช้ตัวเลข + - ( ) และช่องว่าง)'
});

// URL Messages
CommonValidators.url.setMessages('url', {
  pattern: 'URL ต้องขึ้นต้นด้วย http:// หรือ https://',
  maxLength: 'URL ต้องไม่เกิน 200 ตัวอักษร'
});