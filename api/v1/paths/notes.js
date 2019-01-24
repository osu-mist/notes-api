const appRoot = require('app-root-path');

const notesDAO = require('../db/json/notes-dao');

const { paths } = appRoot.require('app').locals.openapi;
const { errorHandler } = appRoot.require('errors/errors');

/**
 * @summary Get notes
 */
const get = async (req, res) => {
  try {
    const result = await notesDAO.getNotes(req.query);
    return res.send(result);
  } catch (err) {
    return errorHandler(res, err);
  }
};

const post = async (req, res) => {
  try {
    const result = await notesDAO.postNotes(req.body);
    return res.status(201).send(result);
  } catch (err) {
    return errorHandler(res, err);
  }
};

get.apiDoc = paths['/notes'].get;
post.apiDoc = paths['/notes'].post;

module.exports = { get, post };
