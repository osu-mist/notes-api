import _ from 'lodash';
import moment from 'moment';
import uuidv4 from 'uuid/v4';

import * as awsOps from './aws-operations';
import { serializeNote, serializeNotes } from '../../serializers/notes-serializer';

// This is the value of the 'source' field that will be set for all notes fetched from the local DB.
const localSourceName = 'advisorPortal';

/**
 * Parses studentId from noteId
 *
 * @param {string} noteId Note ID
 * @returns {string} Student ID
 */
const parseStudentId = (noteId) => noteId.split('-')[0];

/**
 * Fetch a note from the database by its noteId
 *
 * @param {string} noteId Note ID
 * @returns {object} The raw note from the DB
 */
const fetchNote = async (noteId) => {
  const studentId = parseStudentId(noteId);
  const key = `${studentId}/${noteId}.json`;

  const object = await awsOps.getObject(key);
  return object === undefined ? undefined : JSON.parse(object.Body.toString('utf8'));
};

/**
 * Write newContents to the note with id noteId
 *
 * @param {string} noteId Note ID
 * @param {object} newContents New contents of note
 */
const writeNote = async (noteId, newContents) => {
  const studentId = parseStudentId(noteId);
  const key = `${studentId}/${noteId}.json`;
  await awsOps.putObject(newContents, key);
};

/**
 * Filter notes using parameters
 *
 * @param {object[]} rawNotes The list of notes to be filtered
 * @param {object} queryParams Key-value pairs of query parameters and their values
 * @returns {object[]} List of filtered notes
 */
const filterNotes = (rawNotes, queryParams) => {
  // Safely access contextType
  const getContextType = (rawNote) => (rawNote.context ? rawNote.context.contextType : null);
  const {
    'filter[creatorId]': creatorId,
    'filter[note][fuzzy]': noteQuery,
    'filter[source][oneOf]': sources,
    'filter[contextType][oneOf]': contextTypes,
    sort,
  } = queryParams;

  const filterPredicates = {
    creatorId: (note) => !creatorId || note.creatorId === creatorId,
    contextTypes: (note) => !contextTypes || _.includes(contextTypes, getContextType(note)),
    noteQuery: (note) => !noteQuery || _.includes(note.note, noteQuery),
    sources: (note) => (
      !sources || _.some(sources, (it) => {
        const [source, subSource] = it.split('.');
        return (note.source === source) && (!subSource || note.subSource === subSource);
      })
    ),
  };
  _.remove(rawNotes, (note) => !(_.overEvery(Object.values(filterPredicates))(note)));

  const sortOrder = _.startsWith(sort, '-') ? 'desc' : 'asc';
  const sortKey = sort.match(/-?(.+)/)[1];
  // sort first by sort parameter, and then by lastModified descending within each sorted group
  rawNotes = _.orderBy(
    rawNotes,
    [sortKey === 'contextType' ? (it) => getContextType(it) : sortKey, 'lastModified'],
    [sortOrder, 'desc'],
  );
  return rawNotes;
};

/**
 * Return a list of notes filtered/sorted by query parameters
 *
 * @param {object} query Query parameters
 * @returns {Promise} Promise object represents a list of notes
 */
const getNotes = async (query) => {
  const { 'filter[studentId]': studentId } = query;
  const prefix = `${studentId}/`;
  const objects = await awsOps.listObjects({ Prefix: prefix });

  const objectKeys = _.map(objects.Contents, (it) => it.Key);
  _.remove(objectKeys, (it) => _.last(it) === '/');

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
 * Return a specific note by noteId
 *
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
 * Create a new note
 *
 * @param {object} body New note body
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

  await writeNote(noteId, newNote);
  return getNoteById(noteId);
};

/**
 * Patch a note by noteId
 *
 * @param {string} noteId Note ID
 * @param {object} body PATCH body
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
 * Delete a note by noteId
 *
 * @param {string} noteId Note ID
 * @returns {undefined} if object was not found
 */
const deleteNoteById = async (noteId) => {
  const studentId = parseStudentId(noteId);
  const key = `${studentId}/${noteId}.json`;
  if (!await awsOps.objectExists(key)) {
    return undefined;
  }
  await awsOps.deleteObject(key);
  return true;
};

export {
  getNotes,
  postNote,
  getNoteById,
  patchNoteById,
  filterNotes,
  deleteNoteById,
};
