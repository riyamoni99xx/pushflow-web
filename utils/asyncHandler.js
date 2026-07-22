/**
 * Wraps an async route handler so any rejected promise / thrown error
 * is automatically forwarded to next() -> global error handler.
 * Usage: router.get('/x', asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
