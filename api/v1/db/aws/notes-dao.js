const _ = require('lodash');
const moment = require('moment');
const uuidv4 = require('uuid/v4');

const awsOps = require('./aws-operations');
const { serializeNote, serializeNotes } = require('../../serializers/notes-serializer');

// This is the value of the 'source' field that will be set for all notes fetched from the local DB.
const localSourceName = 'advisorPortal';

/**
 * @summary Parses studentId from noteId
 * @function
 * @param noteId
 * @returns {string}
 */
const parseStudentId = noteId => noteId.split('-')[0];

/**
 * @summary Fetch a note from the database by its noteId
 * @function
 * @param noteId
 * @returns {Object} The raw note from the DB
 */
const fetchNote = async (noteId) => {
  const studentId = parseStudentId(noteId);
  const key = `${studentId}/${noteId}.json`;

  const object = await awsOps.getObject(key);
  if (object === undefined) {
    return undefined;
  }
  return JSON.parse(object.Body.toString('utf8'));
};

/**
 * @summary Write newContents to the note with id noteId
 * @function
 * @param {string} noteId
 * @param {Object} newContents
 * @param {boolean} failIfExists If true, the method will throw an error if the note already exists
 */
const writeNote = async (noteId, newContents, failIfExists = false) => {
  const studentId = parseStudentId(noteId);
  const key = `${studentId}/${noteId}.json`;
  if (failIfExists && await awsOps.objectExists(key)) {
    throw new Error(`Error: object with key: "${key}" was not expected to exist`);
  }
  await awsOps.putObject(newContents, key);
};

/**
 * @summary Filter notes using parameters
 * @function
 * @param {Object[]} rawNotes The list of notes to be filtered
 * @param {Object} queryParams Key-value pairs of query parameters and their values
 * @returns {Object[]} List of filtered notes
 */
const filterNotes = (rawNotes, queryParams) => {
  // Safely access contextType
  const getContextType = rawNote => (rawNote.context ? rawNote.context.contextType : null);

  const {
    creatorId,
    q,
    sources,
    sortKey,
    contextTypes,
  } = queryParams;

  rawNotes = creatorId ? _.filter(rawNotes, it => it.creatorId === creatorId) : rawNotes;

  rawNotes = contextTypes
    ? _.filter(rawNotes, it => _.includes(contextTypes, getContextType(it)))
    : rawNotes;
  rawNotes = q ? _.filter(rawNotes, it => _.includes(it.note, q)) : rawNotes;
  // sort first by sortKey, and then by lastModified within each sorted group
  rawNotes = _.orderBy(
    rawNotes,
    [sortKey === 'contextType' ? it => getContextType(it) : sortKey, 'lastModified'],
    [sortKey === 'lastModified' ? 'desc' : 'asc', 'desc'],
  );
  rawNotes = sources ? _.filter(rawNotes, it => _.includes(sources, it.source)) : rawNotes;
  return rawNotes;
};

/**
 * @summary Return a list of notes filtered/sorted by query parameters
 * @function
 * @param {Object} query Query parameters
 * @returns {Promise} Promise object represents a list of notes
 */
const getNotes = async (query) => {
  const { studentId } = query;
  const prefix = `${studentId}/`;
  const objects = await awsOps.listObjects({ Prefix: prefix });

  const objectKeys = _.map(objects.Contents, it => it.Key);
  _.remove(objectKeys, it => _.last(it) === '/');

  let rawNotes = [];
  await Promise.all(_.map(objectKeys, async (it) => {
    const object = await awsOps.getObject(it);
    const noteBody = JSON.parse(object.Body.toString('utf8'));
    noteBody.source = localSourceName;
    rawNotes.push(noteBody);
  }));

  rawNotes = filterNotes(rawNotes, query);

  const serializedNotes = serializeNotes(rawNotes, query);
  return serializedNotes;
};

/**
 * @summary Return a specific note by noteId
 * @function
 * @param {string} noteId id of the note in the form: '{studentId}-{number}'
 * @returns {Promise} Promise object represents a specific note
 */
const getNoteById = async (noteId) => {
  const rawNote = await fetchNote(noteId);
  if (rawNote === undefined) {
    return undefined;
  }
  rawNote.source = localSourceName;
  const serializedNote = serializeNote(rawNote);
  return serializedNote;
};

/**
 * @summary Create a new note
 * @function
 * @param body
 * @returns {Promise} Promise object representing the new note
 */
const postNote = async (body) => {
  const { attributes } = body.data;
  const { note, studentId, creatorId } = attributes;

  // express-openapi does not correctly handle this default value so it must be specified manually
  const permissions = attributes.permissions || 'advisor';
  // ignore additional fields in context
  const context = attributes.context ? {
    contextType: attributes.context.contextType,
    contextId: attributes.context.contextId,
  } : null;

  const studentDirKey = `${studentId}/`;
  // Create student ID directory if it doesn't exist
  if (!await awsOps.objectExists(studentDirKey)) {
    await awsOps.putDir(studentDirKey);
  }

  const noteId = `${studentId}-${uuidv4()}`;

  const newNote = {
    id: noteId,
    note,
    studentId,
    creatorId,
    permissions,
    context,
  };
  newNote.dateCreated = moment().toISOString();
  newNote.lastModified = newNote.dateCreated;

  await writeNote(noteId, newNote, true);
  return getNoteById(noteId);
};

/**
 * @summary Patch a note by noteId
 * @function
 * @param noteId
 * @param body
 * @returns {Promise} Promise object that represents the patched note
 */
const patchNoteById = async (noteId, body) => {
  const rawNote = await fetchNote(noteId);
  if (rawNote === undefined) {
    return undefined;
  }

  const { note, permissions } = body;
  rawNote.note = note || rawNote.note;
  rawNote.permissions = permissions || rawNote.permissions;

  await writeNote(noteId, rawNote);
  return getNoteById(noteId);
};

/**
 * @summary Delete a note by noteId
 * @function
 * @param noteId
 * @returns undefined if object was not found
 */
const deleteNoteById = async (noteId) => {
  const studentId = parseStudentId(noteId);
  const key = `${studentId}/${noteId}.json`;
  const res = await awsOps.deleteObject(key);
  if (res === undefined) {
    return undefined;
  }
  return true;
};

module.exports = {
  getNotes,
  postNote,
  getNoteById,
  patchNoteById,
  filterNotes,
  deleteNoteById,
};
