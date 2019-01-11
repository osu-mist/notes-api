const appRoot = require('app-root-path');
const _ = require('lodash');
const JSONAPISerializer = require('jsonapi-serializer').Serializer;

const { openapi } = appRoot.require('app').locals;
const { serializerOptions } = appRoot.require('utils/jsonapi');
const { querySelfLink, idSelfLink } = appRoot.require('utils/uri-builder');

const noteResourceProp = openapi.definitions.NoteResource.properties;
const noteResourceType = noteResourceProp.type.enum[0];
const noteResourceKeys = _.keys(noteResourceProp.attributes.properties);
const noteResourcePath = 'notes';

// Preserve the string format between the database and the serialized object during serialization
const keyForAttribute = string => string;

/**
 * @summary Serialize noteResources to JSON API
 * @function
 * @param {[Object]} rawNotes Raw data rows from data source
 * @param {Object} query Query parameters
 * @returns {Object} Serialized noteResources object
 */
const serializeNotes = (rawNotes, query) => {
  const topLevelSelfLink = querySelfLink(query, noteResourcePath);
  const serializerArgs = {
    identifierField: 'id',
    resourceKeys: noteResourceKeys,
    resourcePath: noteResourcePath,
    topLevelSelfLink,
    keyForAttribute,
  };

  return new JSONAPISerializer(
    noteResourceType,
    serializerOptions(serializerArgs),
  ).serialize(rawNotes);
};

/**
 * @summary Serialize noteResource to JSON API
 * @function
 * @param {Object} rawNote Raw data row from data source
 * @returns {Object} Serialized noteResource object
 */
const serializeNote = (rawNote) => {
  const topLevelSelfLink = idSelfLink(rawNote.id, noteResourcePath);
  const serializerArgs = {
    identifierField: 'id',
    resourceKeys: noteResourceKeys,
    resourcePath: noteResourcePath,
    topLevelSelfLink,
    keyForAttribute,
  };

  return new JSONAPISerializer(
    noteResourceType,
    serializerOptions(serializerArgs),
  ).serialize(rawNote);
};
module.exports = { serializeNotes, serializeNote };
