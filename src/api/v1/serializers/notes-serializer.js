import _ from 'lodash';
import { Serializer as JsonApiSerializer } from 'jsonapi-serializer';

import { serializerOptions } from 'utils/jsonapi';
import { openapi } from 'utils/load-openapi';
import { apiBaseUrl, resourcePathLink, paramsLink } from 'utils/uri-builder';

const noteResourceProp = openapi.definitions.NoteResource.properties;
const noteResourceType = noteResourceProp.type.enum[0];
const noteResourceKeys = _.keys(noteResourceProp.attributes.properties);
const noteResourcePath = 'notes';
const noteResourceUrl = resourcePathLink(apiBaseUrl, noteResourcePath);

// Preserve the string format between the database and the serialized object during serialization
const keyForAttribute = _.identity;
const enableDataLinks = true;

/**
 * Get serializer args for JsonApiSerializer
 *
 * @param {String} topLevelSelfLink Top-level self link
 * @returns {object} Serializer args
 */
const getSerializerArgs = (topLevelSelfLink) => (
  {
    identifierField: 'id',
    resourceKeys: noteResourceKeys,
    resourcePath: noteResourcePath,
    topLevelSelfLink,
    keyForAttribute,
    enableDataLinks,
  }
);

/**
 * Creates a new JsonApiSerializer
 *
 * @param {object} serializerArgs The serializer args
 * @param {object} data Raw data to be serialized
 * @returns {object} Serializer
 */
const getJsonApiSerializer = (serializerArgs, data) => (
  new JsonApiSerializer(
    noteResourceType,
    serializerOptions(serializerArgs),
  ).serialize(data)
);

/**
 * Serialize noteResources to JSON API
 *
 * @param {object[]} rawNotes Raw data rows from data source
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
export { serializeNotes, serializeNote };
