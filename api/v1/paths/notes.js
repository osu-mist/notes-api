const appRoot = require('app-root-path');

const { errorBuilder, errorHandler } = appRoot.require('errors/errors');
const { openapi: { paths } } = appRoot.require('utils/load-openapi');
const notesDAO = require('../db/json/notes-dao');

/**
 * @summary Get notes
 */
const get = async (req, res) => {
  const studentIDRegex = RegExp(/^\d{9}$/);
  try {
    const { studentID } = req.query;
    if (!studentID) {
      return errorBuilder(res, 400, ['studentID query parameter is required']);
    }
    if (!studentIDRegex.test(studentID)) {
      return errorBuilder(res, 400, ['studentID query parameter must be 9 digits']);
    }
    const notes = notesDAO.getNotes(req.query);
    if (!notes) {
      return errorBuilder(res, 404, 'studentID not found');
    }
    const result = await notesDAO.getPets(req.query);
    return res.send(result);
  } catch (err) {
    return errorHandler(res, err);
  }
};

get.apiDoc = paths['/pets'].get;

module.exports = { get };
