/**
 * Correlation ID Tests
 *
 * Tests for correlation ID utilities
 */

import { describe, it, expect, vi } from 'vitest';
import { Request } from 'express';
import {
  generateCorrelationId,
  extractCorrelationId,
  getOrCreateCorrelationId,
  isValidUUID,
} from '../../src/utils/correlation';

describe('Correlation ID Utilities', () => {
  describe('generateCorrelationId', () => {
    it('should generate a valid UUID', () => {
      const id = generateCorrelationId();

      expect(isValidUUID(id)).toBe(true);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 100; i++) {
        ids.add(generateCorrelationId());
      }

      expect(ids.size).toBe(100);
    });

    it('should generate UUID v4 format', () => {
      const id = generateCorrelationId();

      // UUID v4 has '4' in the 13th character position
      expect(id[14]).toBe('4');
      // UUID v4 has 8, 9, a, or b in the 17th character position
      expect(['8', '9', 'a', 'b']).toContain(id[19]?.toLowerCase());
    });

    it('should generate 36-character string', () => {
      const id = generateCorrelationId();

      expect(id.length).toBe(36);
    });
  });

  describe('extractCorrelationId', () => {
    it('should extract correlation ID from header', () => {
      const mockReq = {
        headers: {
          'x-correlation-id': 'test-id-123',
        },
      } as unknown as Request;

      const id = extractCorrelationId(mockReq, 'x-correlation-id');

      expect(id).toBe('test-id-123');
    });

    it('should handle case-insensitive header names', () => {
      const mockReq = {
        headers: {
          'x-correlation-id': 'test-id-456',
        },
      } as unknown as Request;

      const id = extractCorrelationId(mockReq, 'X-Correlation-ID');

      expect(id).toBe('test-id-456');
    });

    it('should return undefined for missing header', () => {
      const mockReq = {
        headers: {},
      } as unknown as Request;

      const id = extractCorrelationId(mockReq, 'x-correlation-id');

      expect(id).toBeUndefined();
    });

    it('should return undefined for empty header', () => {
      const mockReq = {
        headers: {
          'x-correlation-id': '',
        },
      } as unknown as Request;

      const id = extractCorrelationId(mockReq, 'x-correlation-id');

      expect(id).toBeUndefined();
    });

    it('should handle array header values', () => {
      const mockReq = {
        headers: {
          'x-correlation-id': ['first-id', 'second-id'],
        },
      } as unknown as Request;

      const id = extractCorrelationId(mockReq, 'x-correlation-id');

      expect(id).toBe('first-id');
    });

    it('should handle empty array header values', () => {
      const mockReq = {
        headers: {
          'x-correlation-id': [],
        },
      } as unknown as Request;

      const id = extractCorrelationId(mockReq, 'x-correlation-id');

      expect(id).toBeUndefined();
    });

    it('should use default header name', () => {
      const mockReq = {
        headers: {
          'x-correlation-id': 'default-header-id',
        },
      } as unknown as Request;

      const id = extractCorrelationId(mockReq);

      expect(id).toBe('default-header-id');
    });

    it('should extract from custom header name', () => {
      const mockReq = {
        headers: {
          'x-request-id': 'custom-id',
        },
      } as unknown as Request;

      const id = extractCorrelationId(mockReq, 'x-request-id');

      expect(id).toBe('custom-id');
    });

    it('should sanitize correlation ID with unsafe characters (log injection prevention)', () => {
      const mockReq = {
        headers: {
          'x-correlation-id': 'test\ninjection\rattack',
        },
      } as unknown as Request;

      const id = extractCorrelationId(mockReq, 'x-correlation-id');

      // Should remove newlines and other unsafe characters
      expect(id).toBe('testinjectionattack');
      expect(id).not.toContain('\n');
      expect(id).not.toContain('\r');
    });

    it('should truncate overly long correlation IDs', () => {
      const longId = 'a'.repeat(200);
      const mockReq = {
        headers: {
          'x-correlation-id': longId,
        },
      } as unknown as Request;

      const id = extractCorrelationId(mockReq, 'x-correlation-id');

      expect(id?.length).toBeLessThanOrEqual(128);
    });

    it('should allow hyphens and underscores in correlation IDs', () => {
      const mockReq = {
        headers: {
          'x-correlation-id': 'test-id_with-mixed_separators',
        },
      } as unknown as Request;

      const id = extractCorrelationId(mockReq, 'x-correlation-id');

      expect(id).toBe('test-id_with-mixed_separators');
    });

    it('should return undefined for correlation ID with only unsafe characters', () => {
      const mockReq = {
        headers: {
          'x-correlation-id': '\n\r\t',
        },
      } as unknown as Request;

      const id = extractCorrelationId(mockReq, 'x-correlation-id');

      expect(id).toBeUndefined();
    });
  });

  describe('getOrCreateCorrelationId', () => {
    it('should return existing correlation ID from header', () => {
      const mockReq = {
        headers: {
          'x-correlation-id': 'existing-id',
        },
      } as unknown as Request;

      const id = getOrCreateCorrelationId(mockReq, 'x-correlation-id');

      expect(id).toBe('existing-id');
    });

    it('should generate new ID when header is missing', () => {
      const mockReq = {
        headers: {},
      } as unknown as Request;

      const id = getOrCreateCorrelationId(mockReq, 'x-correlation-id');

      expect(isValidUUID(id)).toBe(true);
    });

    it('should generate new ID when header is empty', () => {
      const mockReq = {
        headers: {
          'x-correlation-id': '',
        },
      } as unknown as Request;

      const id = getOrCreateCorrelationId(mockReq, 'x-correlation-id');

      expect(isValidUUID(id)).toBe(true);
    });

    it('should use default header name', () => {
      const mockReq = {
        headers: {
          'x-correlation-id': 'default-id',
        },
      } as unknown as Request;

      const id = getOrCreateCorrelationId(mockReq);

      expect(id).toBe('default-id');
    });

    it('should support custom header name', () => {
      const mockReq = {
        headers: {
          'x-request-id': 'request-id-value',
        },
      } as unknown as Request;

      const id = getOrCreateCorrelationId(mockReq, 'x-request-id');

      expect(id).toBe('request-id-value');
    });
  });

  describe('isValidUUID', () => {
    it('should return true for valid UUID v1', () => {
      expect(isValidUUID('550e8400-e29b-11d4-a716-446655440000')).toBe(true);
    });

    it('should return true for valid UUID v4', () => {
      expect(isValidUUID('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
    });

    it('should return true for lowercase UUIDs', () => {
      expect(isValidUUID('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d')).toBe(true);
    });

    it('should return true for uppercase UUIDs', () => {
      expect(isValidUUID('A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D')).toBe(true);
    });

    it('should return true for mixed case UUIDs', () => {
      expect(isValidUUID('A1b2C3d4-E5f6-4A7b-8C9d-0E1f2A3b4C5d')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isValidUUID('')).toBe(false);
    });

    it('should return false for random string', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
    });

    it('should return false for UUID without hyphens', () => {
      expect(isValidUUID('f47ac10b58cc4372a5670e02b2c3d479')).toBe(false);
    });

    it('should return false for too short UUID', () => {
      expect(isValidUUID('f47ac10b-58cc-4372-a567-0e02b2c3d47')).toBe(false);
    });

    it('should return false for too long UUID', () => {
      expect(isValidUUID('f47ac10b-58cc-4372-a567-0e02b2c3d4799')).toBe(false);
    });

    it('should return false for invalid characters', () => {
      expect(isValidUUID('f47ac10b-58cc-4372-a567-0e02b2c3d47g')).toBe(false);
    });

    it('should return false for invalid version digit', () => {
      expect(isValidUUID('f47ac10b-58cc-0372-a567-0e02b2c3d479')).toBe(false);
    });

    it('should return false for invalid variant digit', () => {
      expect(isValidUUID('f47ac10b-58cc-4372-0567-0e02b2c3d479')).toBe(false);
    });
  });
});
