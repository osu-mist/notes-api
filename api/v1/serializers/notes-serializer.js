const appRoot = require('app-root-path');
// const decamelize = require('decamelize');
const _ = require('lodash');
const JSONAPISerializer = require('jsonapi-serializer').Serializer;

const { serializerOptions } = appRoot.require('utils/jsonapi');
const { openapi } = appRoot.require('utils/load-openapi');
const { querySelfLink, idSelfLink } = appRoot.require('utils/uri-builder');

const noteResourceProp = openapi.definitions.NoteResource.properties;
const noteResourceType = noteResourceProp.type.enum[0];
const noteResourceKeys = _.keys(noteResourceProp.attributes.properties);
const noteResourcePath = 'notes';

/**
 * @summary Serialize noteResources to JSON API
 * @function
 * @param {[Object]} rawNotes Raw data rows from data source
 * @param {Object} query Query parameters
 * @returns {Object} Serialized noteResources object
 */
const serializeNotes = (rawNotes, query) => {
  const serializerArgs = {
    identifierField: 'id',
    resourceKeys: noteResourceKeys,
  };

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
 * @returns {Object} Serialized noteResource object
 */
const serializeNote = (rawNote) => {
  const serializerArgs = {
    identifierField: 'id',
    resourceKeys: noteResourceKeys,
  };

  const topLevelSelfLink = idSelfLink(rawNote.ID, noteResourcePath);

  return new JSONAPISerializer(
    noteResourceType,
    serializerOptions(serializerArgs, noteResourcePath, topLevelSelfLink),
  ).serialize(rawNote);
};
module.exports = { serializeNotes, serializeNote };
