import { errorBuilder, errorHandler } from 'errors/errors';
import { openapi } from 'utils/load-openapi';

import * as notesDAO from '../../db/awsS3/notes-dao';

const { paths } = openapi;

const notFoundMessage = 'A note with the specified noteId was not found.';

/**
 * GET note by ID
 *
 * @type {RequestHandler}
 */
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
 * PATCH note by ID
 *
 * @type {RequestHandler}
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

/**
 * DELETE note by ID
 *
 * @type {RequestHandler}
 */
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
del.apiDoc = paths['/notes/{noteId}'].delete;

export { get, patch, del };
