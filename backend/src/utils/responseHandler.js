function respondSuccess(res, data, message = 'Success') {
  return res.status(200).json({
    success: true,
    message: message,
    data: data
  });
}

function respondError(res, message, statusCode = 500) {
  res.status(statusCode).json({
    success: false,
    message: message
  });
}

module.exports = {
  respondSuccess,
  respondError
};
