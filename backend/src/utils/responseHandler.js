function respondSuccess(res, data, statusCode = 200) {
  res.status(statusCode).json({
    success: true,
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
