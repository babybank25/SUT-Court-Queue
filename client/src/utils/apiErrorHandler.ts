import { ApiResponse } from '../types';

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  status?: number;
}

export class ApiErrorHandler {
  /**
   * Extract error information from API response
   */
  static extractError(response: ApiResponse | any): ApiError {
    // Handle structured API response
    if (response && typeof response === 'object' && 'success' in response) {
      if (!response.success && response.error) {
        return {
          code: response.error.code || 'UNKNOWN_ERROR',
          message: response.error.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
          details: response.error.details,
          status: response.status
        };
      }
    }

    // Handle fetch errors
    if (response instanceof Error) {
      if (response.name === 'TypeError' && response.message.includes('fetch')) {
        return {
          code: 'NETWORK_ERROR',
          message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
          details: response.message
        };
      }
      
      return {
        code: 'CLIENT_ERROR',
        message: response.message || 'เกิดข้อผิดพลาดในการประมวลผล',
        details: response.stack
      };
    }

    // Handle HTTP status errors
    if (typeof response === 'object' && response.status) {
      return this.getHttpStatusError(response.status, response.statusText);
    }

    // Fallback for unknown errors
    return {
      code: 'UNKNOWN_ERROR',
      message: 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
      details: response
    };
  }

  /**
   * Get user-friendly error message based on HTTP status
   */
  static getHttpStatusError(status: number, statusText?: string): ApiError {
    switch (status) {
      case 400:
        return {
          code: 'BAD_REQUEST',
          message: 'ข้อมูลที่ส่งไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่',
          status
        };
      case 401:
        return {
          code: 'UNAUTHORIZED',
          message: 'ไม่มีสิทธิ์เข้าถึง กรุณาเข้าสู่ระบบใหม่',
          status
        };
      case 403:
        return {
          code: 'FORBIDDEN',
          message: 'ไม่มีสิทธิ์ในการดำเนินการนี้',
          status
        };
      case 404:
        return {
          code: 'NOT_FOUND',
          message: 'ไม่พบข้อมูลที่ต้องการ',
          status
        };
      case 409:
        return {
          code: 'CONFLICT',
          message: 'ข้อมูลขัดแย้งกับข้อมูลที่มีอยู่',
          status
        };
      case 422:
        return {
          code: 'VALIDATION_ERROR',
          message: 'ข้อมูลไม่ถูกต้องตามรูปแบบที่กำหนด',
          status
        };
      case 429:
        return {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'คำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่',
          status
        };
      case 500:
        return {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์ กรุณาลองใหม่ในภายหลัง',
          status
        };
      case 502:
        return {
          code: 'BAD_GATEWAY',
          message: 'เซิร์ฟเวอร์ไม่สามารถตอบสนองได้ กรุณาลองใหม่ในภายหลัง',
          status
        };
      case 503:
        return {
          code: 'SERVICE_UNAVAILABLE',
          message: 'บริการไม่พร้อมใช้งานในขณะนี้ กรุณาลองใหม่ในภายหลัง',
          status
        };
      case 504:
        return {
          code: 'GATEWAY_TIMEOUT',
          message: 'การเชื่อมต่อหมดเวลา กรุณาลองใหม่',
          status
        };
      default:
        return {
          code: 'HTTP_ERROR',
          message: `เกิดข้อผิดพลาด (${status}) ${statusText || ''}`,
          status
        };
    }
  }

  /**
   * Get user-friendly error message for specific error codes
   */
  static getUserFriendlyMessage(errorCode: string): string {
    const messages: Record<string, string> = {
      // Validation errors
      'VALIDATION_ERROR': 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่',
      'TEAM_NAME_EXISTS': 'ชื่อทีมนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น',
      'INVALID_TEAM_NAME': 'ชื่อทีมไม่ถูกต้อง',
      'INVALID_MEMBER_COUNT': 'จำนวนสมาชิกไม่ถูกต้อง',
      'INVALID_CONTACT_INFO': 'ข้อมูลติดต่อไม่ถูกต้อง',
      
      // Queue errors
      'QUEUE_FULL': 'คิวเต็มแล้ว กรุณารอสักครู่แล้วลองใหม่',
      'TEAM_ALREADY_IN_QUEUE': 'ทีมนี้อยู่ในคิวแล้ว',
      'TEAM_NOT_IN_QUEUE': 'ไม่พบทีมในคิว',
      
      // Match errors
      'MATCH_NOT_FOUND': 'ไม่พบการแข่งขัน',
      'MATCH_NOT_ACTIVE': 'การแข่งขันไม่ได้เริ่มแล้ว',
      'MATCH_NOT_CONFIRMING': 'การแข่งขันไม่อยู่ในสถานะรอการยืนยัน',
      'TEAM_NOT_IN_MATCH': 'ทีมไม่ได้อยู่ในการแข่งขันนี้',
      'MATCH_ALREADY_CONFIRMED': 'การแข่งขันได้รับการยืนยันแล้ว',
      
      // Authentication errors
      'UNAUTHORIZED': 'ไม่มีสิทธิ์เข้าถึง กรุณาเข้าสู่ระบบใหม่',
      'FORBIDDEN': 'ไม่มีสิทธิ์ในการดำเนินการนี้',
      'INVALID_CREDENTIALS': 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
      'TOKEN_EXPIRED': 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
      
      // Network errors
      'NETWORK_ERROR': 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
      'TIMEOUT_ERROR': 'การเชื่อมต่อหมดเวลา กรุณาลองใหม่',
      
      // Rate limiting
      'RATE_LIMIT_EXCEEDED': 'คำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่',
      
      // Server errors
      'INTERNAL_SERVER_ERROR': 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์ กรุณาลองใหม่ในภายหลัง',
      'SERVICE_UNAVAILABLE': 'บริการไม่พร้อมใช้งานในขณะนี้ กรุณาลองใหม่ในภายหลัง',
      
      // Default
      'UNKNOWN_ERROR': 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'
    };

    return messages[errorCode] || messages['UNKNOWN_ERROR'];
  }

  /**
   * Check if error is retryable
   */
  static isRetryableError(error: ApiError): boolean {
    const retryableCodes = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'INTERNAL_SERVER_ERROR',
      'BAD_GATEWAY',
      'SERVICE_UNAVAILABLE',
      'GATEWAY_TIMEOUT'
    ];

    const retryableStatuses = [500, 502, 503, 504];

    return retryableCodes.includes(error.code) || 
           (error.status !== undefined && retryableStatuses.includes(error.status));
  }

  /**
   * Check if error requires authentication
   */
  static requiresAuth(error: ApiError): boolean {
    return error.code === 'UNAUTHORIZED' || 
           error.code === 'TOKEN_EXPIRED' || 
           error.status === 401;
  }

  /**
   * Format error for logging
   */
  static formatForLogging(error: ApiError, context?: string): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` [${context}]` : '';
    
    return `${timestamp}${contextStr} ${error.code}: ${error.message}${
      error.details ? ` | Details: ${JSON.stringify(error.details)}` : ''
    }`;
  }
}