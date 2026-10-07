// Sends the agreed success format: { success, message, data, meta? }
exports.sendSuccess = (res, { statusCode = 200, message, data = null, meta }) => {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};
