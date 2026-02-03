const { asyncHandler, StatusCodeError } = require('./endpointHelper.js');

describe('endpointHelper', () => {
  describe('StatusCodeError', () => {
    test('should create error with message and statusCode', () => {
      const error = new StatusCodeError('Test error', 404);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(404);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('asyncHandler', () => {
    test('should handle successful async function', async () => {
      const req = {};
      const res = {};
      const next = jest.fn();
      const handler = jest.fn().mockResolvedValue('success');

      const wrapped = asyncHandler(handler);
      await wrapped(req, res, next);

      expect(handler).toHaveBeenCalledWith(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });

    test('should catch and pass errors to next', async () => {
      const req = {};
      const res = {};
      const next = jest.fn();
      const error = new Error('Test error');
      const handler = jest.fn().mockRejectedValue(error);

      const wrapped = asyncHandler(handler);
      await wrapped(req, res, next);

      expect(handler).toHaveBeenCalledWith(req, res, next);
      expect(next).toHaveBeenCalledWith(error);
    });

    test('should handle StatusCodeError', async () => {
      const req = {};
      const res = {};
      const next = jest.fn();
      const error = new StatusCodeError('Not found', 404);
      const handler = jest.fn().mockRejectedValue(error);

      const wrapped = asyncHandler(handler);
      await wrapped(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
