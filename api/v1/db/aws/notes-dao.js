const _ = require('lodash');
const moment = require('moment');
const uuidv4 = require('uuid/v4');

const awsOps = require('./aws-operations');
const { serializeNote, serializeNotes } = require('../../serializers/notes-serializer');

// This is the value of the 'source' field that will be set for all notes fetched from the local DB.
const localSourceName = 'advisorPortal';

/**
 * @summary Parses studentID from noteID
 * @function
 * @param noteID
 * @returns {string}
 */
const parseStudentID = noteID => noteID.split('-')[0];

/**
 * @summary Fetch a note from the database by its noteID
 * @function
 * @param noteID
 * @returns {Object} The raw note from the DB
 */
const fetchNote = async (noteID) => {
  const studentID = parseStudentID(noteID);
  const key = `${studentID}/${noteID}.json`;

  if (!await awsOps.objectExists(key)) {
    return undefined;
  }
  const object = await awsOps.getObject(key);
  return JSON.parse(object.Body.toString('utf8'));
};

/**
 * @summary Write newContents to the note with id noteID
 * @function
 * @param {string} noteID
 * @param {Object} newContents
 * @param {boolean} failIfExists If true, the method will throw an error if the note already exists
 */
const writeNote = async (noteID, newContents, failIfExists = false) => {
  const studentID = parseStudentID(noteID);
  const key = `${studentID}/${noteID}.json`;
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
    creatorID,
    q,
    sources,
    sortKey,
    contextTypes,
  } = queryParams;

  rawNotes = creatorID ? _.filter(rawNotes, it => it.creatorID === creatorID) : rawNotes;

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
  const { studentID } = query;
  const prefix = `${studentID}/`;
  const objects = await awsOps.listObjects({ Prefix: prefix });

  const objectKeys = _.map(objects.Contents, it => it.Key);
  _.remove(objectKeys, it => it[it.length - 1] === '/');

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
 * @summary Return a specific note by noteID
 * @function
 * @param {string} noteID id of the note in the form: '{studentID}-{number}'
 * @returns {Promise} Promise object represents a specific note
 */
const getNoteByID = async (noteID) => {
  const rawNote = await fetchNote(noteID);
  if (!rawNote) {
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
  const { note, studentID, creatorID } = attributes;

  // express-openapi does not correctly handle this default value so it must be specified manually
  const permissions = attributes.permissions || 'advisor';
  // ignore additional fields in context
  const context = attributes.context ? {
    contextType: attributes.context.contextType,
    contextID: attributes.context.contextID,
  } : null;

  const studentDirKey = `${studentID}/`;
  // Create student ID directory if it doesn't exist
  if (!await awsOps.objectExists(studentDirKey)) {
    await awsOps.putDir(studentDirKey);
  }

  const noteID = `${studentID}-${uuidv4()}`;

  const newNote = {
    id: noteID,
    note,
    studentID,
    creatorID,
    permissions,
    context,
  };
  newNote.dateCreated = moment().toISOString();
  newNote.lastModified = newNote.dateCreated;

  await writeNote(noteID, newNote, true);
  return getNoteByID(noteID);
};

/**
 * @summary Patch a note by noteID
 * @function
 * @param noteID
 * @param body
 * @returns {Promise} Promise object that represents the patched note
 */
const patchNoteByID = async (noteID, body) => {
  const rawNote = await fetchNote(noteID);
  if (!rawNote) {
    return undefined;
  }

  console.log(JSON.stringify(body, null, 2));

  const { note, permissions } = body;
  rawNote.note = note || rawNote.note;
  rawNote.permissions = permissions || rawNote.permissions;

  await writeNote(noteID, rawNote);
  return getNoteByID(noteID);
};

/**
 * @summary Delete a note by noteID
 * @function
 * @param noteID
 * @returns undefined if object was not found
 */
const deleteNoteByID = async (noteID) => {
  const studentID = parseStudentID(noteID);
  const key = `${studentID}/${noteID}.json`;
  await awsOps.deleteObject(key);
};

module.exports = {
  getNotes,
  postNote,
  getNoteByID,
  patchNoteByID,
  filterNotes,
  deleteNoteByID,
};
