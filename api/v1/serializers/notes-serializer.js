const appRoot = require('app-root-path');
const _ = require('lodash');
const JSONAPISerializer = require('jsonapi-serializer').Serializer;

const { serializerOptions } = appRoot.require('utils/jsonapi');
const { openapi } = appRoot.require('utils/load-openapi');
const { apiBaseUrl, resourcePathLink, paramsLink } = appRoot.require('utils/uri-builder');

const noteResourceProp = openapi.definitions.NoteResource.properties;
const noteResourceType = noteResourceProp.type.enum[0];
const noteResourceKeys = _.keys(noteResourceProp.attributes.properties);
const noteResourcePath = 'notes';
const noteResourceUrl = resourcePathLink(apiBaseUrl, noteResourcePath);

// Preserve the string format between the database and the serialized object during serialization
const keyForAttribute = string => string;
const enableDataLinks = true;

const getSerializerArgs = topLevelSelfLink => (
  {
    identifierField: 'id',
    resourceKeys: noteResourceKeys,
    resourcePath: noteResourcePath,
    topLevelSelfLink,
    keyForAttribute,
    enableDataLinks,
  }
);

const getJSONAPISerializer = (serializerArgs, data) => (
  new JSONAPISerializer(
    noteResourceType,
    serializerOptions(serializerArgs),
  ).serialize(data)
);

/**
 * @summary Serialize noteResources to JSON API
 * @function
 * @param {[Object]} rawNotes Raw data rows from data source
 * @param {Object} query Query parameters
 * @returns {Object} Serialized noteResources object
 */
const serializeNotes = (rawNotes, query) => {
  const topLevelSelfLink = paramsLink(noteResourceUrl, query);
  const serializerArgs = getSerializerArgs(topLevelSelfLink);
  return getJSONAPISerializer(serializerArgs, rawNotes);
};

/**
 * @summary Serialize noteResource to JSON API
 * @function
 * @param {Object} rawNote Raw data row from data source
 * @returns {Object} Serialized noteResource object
 */
const serializeNote = (rawNote) => {
  const topLevelSelfLink = resourcePathLink(noteResourceUrl, rawNote.id);
  const serializerArgs = getSerializerArgs(topLevelSelfLink);
  return getJSONAPISerializer(serializerArgs, rawNote);
};
module.exports = { serializeNotes, serializeNote };
