const appRoot = require('app-root-path');

const { errorBuilder, errorHandler } = appRoot.require('errors/errors');
const { openapi: { paths } } = appRoot.require('utils/load-openapi');
const petsDAO = require('../../db/json/notes-dao');

/**
 * @summary Get pet by unique ID
 */
const get = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await petsDAO.getPetById(id);
    if (!result) {
      errorBuilder(res, 404, 'A pet with the specified ID was not found.');
    } else {
      res.send(result);
    }
  } catch (err) {
    errorHandler(res, err);
  }
};

get.apiDoc = paths['/notes/{noteID}'].get;

module.exports = { get };