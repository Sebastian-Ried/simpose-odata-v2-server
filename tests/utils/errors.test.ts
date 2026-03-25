/**
 * Error Handling Tests
 *
 * Tests for OData error utilities
 */

import { describe, it, expect } from 'vitest';
import {
  ODataError,
  formatODataError,
  badRequest,
  notFound,
  methodNotAllowed,
  conflict,
  preconditionFailed,
  internalError,
  notImplemented,
  createErrorHandler,
} from '../../src/utils/errors';

describe('Error Utilities', () => {
  describe('ODataError', () => {
    it('should create error with status code and message', () => {
      const error = new ODataError(404, 'Resource not found');

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Resource not found');
      expect(error.code).toBe('404');
      expect(error.name).toBe('ODataError');
    });

    it('should include inner error', () => {
      const inner = new Error('Database connection failed');
      const error = new ODataError(500, 'Server error', inner);

      expect(error.innerError).toBe(inner);
    });

    it('should be instance of Error', () => {
      const error = new ODataError(400, 'Bad request');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ODataError);
    });

    it('should have stack trace', () => {
      const error = new ODataError(500, 'Test');

      expect(error.stack).toBeDefined();
    });
  });

  describe('formatODataError', () => {
    it('should format basic error', () => {
      const result = formatODataError(404, 'Not found');

      expect(result.error.code).toBe('404');
      expect(result.error.message.lang).toBe('en');
      expect(result.error.message.value).toBe('Not found');
    });

    it('should not include innererror when not verbose', () => {
      const inner = new Error('Secret');
      const result = formatODataError(500, 'Error', inner, false);

      expect(result.error.innererror).toBeUndefined();
    });

    it('should include innererror when verbose', () => {
      const inner = new Error('Details');
      inner.stack = 'at test.ts:1';
      const result = formatODataError(500, 'Error', inner, true);

      expect(result.error.innererror).toBeDefined();
      expect(result.error.innererror?.message).toBe('Details');
      expect(result.error.innererror?.stacktrace).toContain('test.ts');
    });
  });

  describe('Error Factory Functions', () => {
    it('badRequest should create 400 error', () => {
      const error = badRequest('Invalid input');

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
    });

    it('notFound should create 404 error', () => {
      const error = notFound('Product');

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Product not found');
    });

    it('methodNotAllowed should create 405 error', () => {
      const error = methodNotAllowed('DELETE');

      expect(error.statusCode).toBe(405);
      expect(error.message).toBe('Method DELETE not allowed');
    });

    it('conflict should create 409 error', () => {
      const error = conflict('Resource already exists');

      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Resource already exists');
    });

    it('preconditionFailed should create 412 error', () => {
      const error = preconditionFailed('ETag mismatch');

      expect(error.statusCode).toBe(412);
      expect(error.message).toBe('ETag mismatch');
    });

    it('internalError should create 500 error', () => {
      const inner = new Error('Database error');
      const error = internalError('Server error', inner);

      expect(error.statusCode).toBe(500);
      expect(error.innerError).toBe(inner);
    });

    it('notImplemented should create 501 error', () => {
      const error = notImplemented('$batch');

      expect(error.statusCode).toBe(501);
      expect(error.message).toBe('$batch is not implemented');
    });
  });

  describe('createErrorHandler', () => {
    it('should create middleware function', () => {
      const handler = createErrorHandler();

      expect(typeof handler).toBe('function');
      expect(handler.length).toBe(4); // Express error handler signature
    });

    it('should handle ODataError', () => {
      const handler = createErrorHandler();
      const error = new ODataError(400, 'Bad request');

      let responseStatus: number | undefined;
      let responseBody: any;

      const mockRes = {
        headersSent: false,
        status: (code: number) => {
          responseStatus = code;
          return mockRes;
        },
        json: (body: any) => {
          responseBody = body;
        },
      };

      handler(error, {} as any, mockRes as any, () => {});

      expect(responseStatus).toBe(400);
      expect(responseBody.error.code).toBe('400');
    });

    it('should handle generic Error as 500', () => {
      const handler = createErrorHandler();
      const error = new Error('Something broke');

      let responseStatus: number | undefined;

      const mockRes = {
        headersSent: false,
        status: (code: number) => {
          responseStatus = code;
          return mockRes;
        },
        json: () => {},
      };

      handler(error, {} as any, mockRes as any, () => {});

      expect(responseStatus).toBe(500);
    });

    it('should call next if headers already sent', () => {
      const handler = createErrorHandler();
      const error = new Error('Test');

      let nextCalled = false;

      const mockRes = {
        headersSent: true,
      };

      handler(error, {} as any, mockRes as any, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it('should include stack trace when verbose', () => {
      const handler = createErrorHandler(true);
      const error = new ODataError(500, 'Error', new Error('Inner'));

      let responseBody: any;

      const mockRes = {
        headersSent: false,
        status: () => mockRes,
        json: (body: any) => {
          responseBody = body;
        },
      };

      handler(error, {} as any, mockRes as any, () => {});

      expect(responseBody.error.innererror).toBeDefined();
    });
  });
});
