const appRoot = require('app-root-path');

const notesDAO = require('../../db/json/notes-dao');

const { errorBuilder, errorHandler } = appRoot.require('errors/errors');
const { openapi: { paths } } = appRoot.require('utils/load-openapi');

/**
 * @summary Patch note by ID
 */
const patch = async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req;
    const result = await notesDAO.patchNoteByID(id, body);
    if (result === undefined) {
      errorBuilder(res, 404, 'A note with the specified noteID was not found.');
    } else {
      res.send(result);
    }
  } catch (err) {
    errorHandler(res, err);
  }
};

patch.apiDoc = paths['/notes/{noteID}'].patch;

module.exports = { patch };
