const appRoot = require('app-root-path');
const _ = require('lodash');
const JsonApiSerializer = require('jsonapi-serializer').Serializer;

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

const getJsonApiSerializer = (serializerArgs, data) => (
  new JsonApiSerializer(
    noteResourceType,
    serializerOptions(serializerArgs),
  ).serialize(data)
);

/**
 * Serialize noteResources to JSON API
 *
 * @param {[object]} rawNotes Raw data rows from data source
 * @param {object} query Query parameters
 * @returns {object} Serialized noteResources object
 */
const serializeNotes = (rawNotes, query) => {
  const topLevelSelfLink = paramsLink(noteResourceUrl, query);
  const serializerArgs = getSerializerArgs(topLevelSelfLink);
  return getJsonApiSerializer(serializerArgs, rawNotes);
};

/**
 * Serialize noteResource to JSON API
 *
 * @param {object} rawNote Raw data row from data source
 * @returns {object} Serialized noteResource object
 */
const serializeNote = (rawNote) => {
  const topLevelSelfLink = resourcePathLink(noteResourceUrl, rawNote.id);
  const serializerArgs = getSerializerArgs(topLevelSelfLink);
  return getJsonApiSerializer(serializerArgs, rawNote);
};
module.exports = { serializeNotes, serializeNote };
