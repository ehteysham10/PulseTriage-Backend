// ─────────────────────────────────────────────────────────────
// Global Error Handler Middleware
// Must be registered LAST in server.js: app.use(errorHandler)
// Catches any error passed via next(err) from any route/controller
// ─────────────────────────────────────────────────────────────

// Handles Mongoose CastError (e.g. invalid ObjectId in URL params)
const handleCastError = (err) => ({
  status: 400,
  message: `Invalid value for field "${err.path}": ${err.value}`
});

// Handles Mongoose Validation Errors (e.g. required field missing)
const handleValidationError = (err) => ({
  status: 400,
  message: Object.values(err.errors).map(e => e.message).join(', ')
});

// Handles MongoDB Duplicate Key Error (e.g. email/username already exists)
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  return {
    status: 409,
    message: `"${err.keyValue[field]}" is already in use. Please choose a different ${field}.`
  };
};

// Handles JWT Errors
const handleJWTError = () => ({
  status: 401,
  message: 'Invalid or expired token. Please log in again.'
});

export const errorHandler = (err, req, res, next) => {
  console.error(`\n[ERROR] ${req.method} ${req.originalUrl}`);
  console.error(`  Message : ${err.message}`);
  if (process.env.NODE_ENV !== 'production') {
    console.error(`  Stack   : ${err.stack}`);
  }

  let status = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose: Invalid ObjectId
  if (err.name === 'CastError') {
    ({ status, message } = handleCastError(err));
  }
  // Mongoose: Validation failed
  else if (err.name === 'ValidationError') {
    ({ status, message } = handleValidationError(err));
  }
  // MongoDB: Duplicate key (code 11000)
  else if (err.code === 11000) {
    ({ status, message } = handleDuplicateKeyError(err));
  }
  // JWT: Token invalid or expired
  else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    ({ status, message } = handleJWTError());
  }

  res.status(status).json({
    success: false,
    message
  });
};
