import { errorHandler } from 'errors/errors';
import { openapi } from 'utils/load-openapi';

import * as notesDAO from '../db/awsS3/notes-dao';

const { paths } = openapi;

/**
 * GET notes
 *
 * @type {RequestHandler}
 */
const get = async (req, res) => {
  try {
    const result = await notesDAO.getNotes(req.query);
    return res.send(result);
  } catch (err) {
    return errorHandler(res, err);
  }
};

/**
 * POST note
 *
 * @type {RequestHandler}
 */
const post = async (req, res) => {
  try {
    const result = await notesDAO.postNote(req.body);
    res.set('Location', result.data.links.self);
    return res.status(201).send(result);
  } catch (err) {
    return errorHandler(res, err);
  }
};

get.apiDoc = paths['/notes'].get;
post.apiDoc = paths['/notes'].post;

export { get, post };
