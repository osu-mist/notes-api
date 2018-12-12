const appRoot = require('app-root-path');
const decamelize = require('decamelize');
const _ = require('lodash');
const JSONAPISerializer = require('jsonapi-serializer').Serializer;

const { paginate } = appRoot.require('utils/paginator');
const { serializerOptions } = appRoot.require('utils/jsonapi');
const { openapi } = appRoot.require('utils/load-openapi');
const { querySelfLink, idSelfLink } = appRoot.require('utils/uri-builder');

const noteResourceProp = openapi.definitions.NoteResource.properties;
const noteResourceType = noteResourceProp.type.enum[0];
const noteResourceKeys = _.keys(noteResourceProp.attributes.properties);
const noteResourcePath = 'notes';

/**
 * The column name getting from database is usually UPPER_CASE.
 * This block of code is to make the camelCase keys defined in openapi.yaml be
 * UPPER_CASE so that the serializer can correctly match the corresponding columns
 * from the raw data rows.
 */
_.forEach(noteResourceKeys, (key, index) => {
  noteResourceKeys[index] = decamelize(key).toUpperCase();
});

/**
 * @summary Serialize noteResources to JSON API
 * @function
 * @param {[Object]} rawNotes Raw data rows from data source
 * @param {Object} query Query parameters
 * @returns {Object} Serialized noteResources object
 */
const SerializedNotes = (rawNotes, query) => {
  const serializerArgs = {
    identifierField: 'ID',
    resourceKeys: noteResourceKeys,
  };

  /**
   * Add pagination links and meta information to options if pagination is enabled
   */
  const pageQuery = {
    size: query['page[size]'],
    number: query['page[number]'],
  };

  const pagination = paginate(rawNotes, pageQuery);
  pagination.totalResults = rawNotes.length;
  serializerArgs.pagination = pagination;
  rawNotes = pagination.paginatedRows;

  const topLevelSelfLink = querySelfLink(query, noteResourcePath);

  return new JSONAPISerializer(
    noteResourceType,
    serializerOptions(serializerArgs, noteResourcePath, topLevelSelfLink),
  ).serialize(rawNotes);
};

/**
 * @summary Serialize noteResource to JSON API
 * @function
 * @param {Object} rawNote Raw data row from data source
 * @param {string} endpointUri Endpoint URI for creating self-link
 * @returns {Object} Serialized noteResource object
 */
const SerializedNote = (rawNote) => {
  const serializerArgs = {
    identifierField: 'ID',
    resourceKeys: noteResourceKeys,
  };

  const topLevelSelfLink = idSelfLink(rawNote.ID, noteResourcePath);

  return new JSONAPISerializer(
    noteResourceType,
    serializerOptions(serializerArgs, noteResourcePath, topLevelSelfLink),
  ).serialize(rawNote);
};
module.exports = { SerializedNotes, SerializedNote };
