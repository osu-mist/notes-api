const appRoot = require('app-root-path');

const { errorBuilder, errorHandler } = appRoot.require('errors/errors');
const { openapi: { paths } } = appRoot.require('utils/load-openapi');
const notesDAO = require('../../db/json/notes-dao');

const notFoundMessage = 'A note with the specified noteID was not found.';

const get = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await notesDAO.getNoteByID(id);
    if (!result) {
      errorBuilder(res, 404, notFoundMessage);
    } else {
      res.send(result);
    }
  } catch (err) {
    errorHandler(res, err);
  }
};

/**
 * @summary Patch note by ID
 */
const patch = async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req;
    const result = await notesDAO.patchNoteByID(id, body);
    if (!result) {
      errorBuilder(res, 404, notFoundMessage);
    } else {
      res.send(result);
    }
  } catch (err) {
    errorHandler(res, err);
  }
};

const del = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await notesDAO.deleteNoteByID(id);
    if (!result) {
      errorBuilder(res, 404, notFoundMessage);
    } else {
      res.status(204).send();
    }
  } catch (err) {
    errorHandler(res, err);
  }
};

get.apiDoc = paths['/notes/{noteID}'].get;
patch.apiDoc = paths['/notes/{noteID}'].patch;
del.apiDoc = paths['/notes/{noteID}'].del;

module.exports = { get, patch, del };
