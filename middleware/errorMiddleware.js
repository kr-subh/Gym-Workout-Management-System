// 404 - Page not found
const notFound = (req, res, next) => {
  const err = new Error(`Page Not Found: ${req.originalUrl}`);
  err.status = 404;
  next(err);
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  // If headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || 500;
  console.error(`[Error ${statusCode}]: ${err.message}`);

  res.status(statusCode).render('error', {
    title: 'Error',
    statusCode,
    message: err.message || 'Something went wrong. Please try again.',
  });
};

module.exports = { notFound, errorHandler };
