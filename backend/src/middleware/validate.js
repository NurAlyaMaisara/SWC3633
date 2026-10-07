const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

// Usage: validate(rules) -> runs the express-validator rules, then returns a
// 422 VALIDATION_ERROR listing each invalid field if any rule failed.
module.exports = (rules) => [
  ...rules,
  (req, res, next) => {
    const result = validationResult(req);
    if (result.isEmpty()) return next();
    const details = result
      .array({ onlyFirstError: true })
      .map((e) => ({ field: e.path, message: e.msg }));
    next(ApiError.validation(details));
  },
];
