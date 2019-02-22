const appRoot = require('app-root-path');

const notesDAO = require('../../db/aws/notes-dao');

const { errorBuilder, errorHandler } = appRoot.require('errors/errors');
const { openapi: { paths } } = appRoot.require('utils/load-openapi');

const notFoundMessage = 'A note with the specified noteId was not found.';

const get = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await notesDAO.getNoteById(id);
    if (result === undefined) {
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
    const result = await notesDAO.patchNoteById(id, body);
    if (result === undefined) {
      errorBuilder(res, 404, 'A note with the specified noteId was not found.');
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
    const result = await notesDAO.deleteNoteById(id);
    if (result === undefined) {
      errorBuilder(res, 404, notFoundMessage);
    } else {
      res.status(204).send();
    }
  } catch (err) {
    errorHandler(res, err);
  }
};

get.apiDoc = paths['/notes/{noteId}'].get;
patch.apiDoc = paths['/notes/{noteId}'].patch;
del.apiDoc = paths['/notes/{noteId}'].del;

module.exports = { get, patch, del };
