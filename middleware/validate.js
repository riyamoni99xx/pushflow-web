const { validationResult } = require('express-validator');
const ApiError = require('../utils/apiError');

/**
 * Runs after an array of express-validator checks in a route definition.
 * Usage: router.post('/x', [body('email').isEmail()], validate, controller.fn)
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
    return next(ApiError.badRequest('Validation failed', details));
  }
  next();
}

module.exports = validate;
