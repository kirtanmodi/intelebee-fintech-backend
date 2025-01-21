const createErrorResponse = (statusCode, message, details = null) => ({
  statusCode,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With,Origin,Accept",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS,HEAD",
    "Access-Control-Max-Age": "3600",
  },
  body: JSON.stringify({
    error: message,
    ...(details && { details }),
    timestamp: new Date().toISOString(),
  }),
});

const createSuccessResponse = (data) => ({
  statusCode: 200,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With,Origin,Accept",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS,HEAD",
    "Access-Control-Max-Age": "3600",
  },
  body: JSON.stringify({
    success: true,
    ...data,
    timestamp: new Date().toISOString(),
  }),
});

module.exports = {
  createErrorResponse,
  createSuccessResponse,
};
