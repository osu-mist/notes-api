const appRoot = require('app-root-path');

const notesDAO = require('../db/awsS3/notes-dao');

const { errorHandler } = appRoot.require('errors/errors');
const { openapi: { paths } } = appRoot.require('utils/load-openapi');

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

module.exports = { get, post };
