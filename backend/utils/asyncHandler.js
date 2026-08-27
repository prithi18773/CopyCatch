/**
 * Express 4 does not catch rejected promises thrown inside async route
 * handlers - an unhandled rejection there either hangs the request or, if
 * nothing else catches it, crashes the whole process. Wrapping every
 * controller in this forwards the error to the centralized error handler
 * in server.js instead.
 */
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
