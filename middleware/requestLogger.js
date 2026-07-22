const morgan = require('morgan');
const logger = require('../utils/logger');

const stream = {
  write: (message) => logger.http ? logger.http(message.trim()) : logger.info(message.trim()),
};

const skip = () => process.env.NODE_ENV === 'test';

const requestLogger = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream, skip }
);

module.exports = requestLogger;
