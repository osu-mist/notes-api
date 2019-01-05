const appRoot = require('app-root-path');
const _ = require('lodash');

const { errorBuilder, errorHandler } = appRoot.require('errors/errors');

/**
 * @summary Middleware that handles generic errors
 */
const genericErrorMiddleware = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = _.has(err, 'customStatus') ? err.customStatus : 500;
  let detail = _.has(err, 'customMessage') ? err.customMessage : null;
  detail = status === 400 ? [detail] : detail;

  if (status === 500) {
    if (detail) {
      console.error(detail);
    }
    errorHandler(res, err);
  } else {
    errorBuilder(res, status, detail);
  }
};

module.exports = { genericErrorMiddleware };
