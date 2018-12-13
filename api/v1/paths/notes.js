const appRoot = require('app-root-path');

const { errorBuilder, errorHandler } = appRoot.require('errors/errors');
const { openapi: { paths } } = appRoot.require('utils/load-openapi');
const notesDAO = require('../db/json/notes-dao');

/**
 * @summary Get notes
 */
const get = async (req, res) => {
  try {
    const result = await notesDAO.getNotes(req.query);
    if (!result) {
      return errorBuilder(res, 404, 'studentID not found');
    }
    return res.send(result);
  } catch (err) {
    return errorHandler(res, err);
  }
};

get.apiDoc = paths['/notes'].get;

module.exports = { get };
