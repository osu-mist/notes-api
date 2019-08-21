const config = require('config');
const fs = require('fs');
const _ = require('lodash');
const moment = require('moment');
const path = require('path');

const fsOps = require('./fs-operations');
const { serializeNotes, serializeNote } = require('../../serializers/notes-serializer');

const { dbPath } = config.get('dataSources.json');
// This is the value of the 'source' field that will be set for all notes fetched from the local DB.
const localSourceName = 'advisorPortal';

/**
 * Parses studentId from noteId
 *
 * @param {string} noteId Note ID
 * @returns {string} Student ID
 */
const parseStudentId = noteId => noteId.split('-')[0];

/**
 * Filter notes using parameters
 *
 * @param {object[]} rawNotes The list of notes to be filtered
 * @param {object} queryParams Key-value pairs of query parameters and their values
 * @returns {object[]} List of filtered notes
 */
const filterNotes = (rawNotes, queryParams) => {
  // Safely access contextType
  const getContextType = rawNote => (rawNote.context ? rawNote.context.contextType : null);

  const {
    creatorId, q, sources, sortKey, contextTypes,
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
 * Return a list of notes filtered/sorted by query parameters
 *
 * @param {object} query Query parameters
 * @returns {Promise} Promise object represents a list of notes
 */
const getNotes = query => new Promise((resolve, reject) => {
  try {
    const { studentId } = query;
    const studentDirPath = `${dbPath}/${studentId}`;
    let noteFiles = fs.existsSync(studentDirPath) ? fs.readdirSync(studentDirPath) : [];
    noteFiles = _.filter(noteFiles, it => path.extname(it).toLowerCase() === '.json');

    let rawNotes = [];
    _.forEach(noteFiles, (file) => {
      const rawNote = fsOps.readJsonFile(`${studentDirPath}/${file}`);
      rawNote.source = localSourceName;
      rawNotes.push(rawNote);
    });
    rawNotes = filterNotes(rawNotes, query);

    const serializedNotes = serializeNotes(rawNotes, query);
    resolve(serializedNotes);
  } catch (err) {
    reject(err);
  }
});

/**
 * Fetch a note from the database by its noteId
 *
 * @param {string} noteId Note ID
 * @returns {object} The raw note from the DB
 */
const fetchNote = (noteId) => {
  try {
    const studentId = parseStudentId(noteId);
    const studentDirPath = `${dbPath}/${studentId}`;
    return fsOps.readJsonFile(`${studentDirPath}/${noteId}.json`);
  } catch (err) {
    return undefined;
  }
};

/**
 * Write newContents to the note with id noteId
 *
 * @param {string} noteId Note ID
 * @param {string} newContents New contents
 * @param {boolean} failIfExists If true, the method will throw an error if the file already exists
 */
const writeNote = (noteId, newContents, failIfExists = false) => {
  const options = failIfExists ? { flag: 'wx' } : { flag: 'w' };
  const studentId = parseStudentId(noteId);
  const noteFilePath = `${dbPath}/${studentId}/${noteId}.json`;
  fsOps.writeJsonFile(noteFilePath, newContents, options);
};

/**
 * Return a specific note by noteId
 *
 * @param {string} noteId id of the note in the form: '{studentId}-{number}'
 * @returns {Promise} Promise object represents a specific note
 */
const getNoteById = noteId => new Promise((resolve, reject) => {
  try {
    const rawNote = fetchNote(noteId);
    if (!rawNote) {
      resolve(undefined);
    }
    rawNote.source = localSourceName;

    const serializedNote = serializeNote(rawNote);
    resolve(serializedNote);
  } catch (err) {
    reject(err);
  }
});

/**
 * Create a new note
 *
 * @param {object} body New note
 * @returns {Promise} Promise object representing the new note
 */
const postNote = body => new Promise((resolve, reject) => {
  try {
    const { attributes } = body.data;
    const {
      note, studentId, creatorId,
    } = attributes;

    // express-openapi does not correctly handle this default value so it must be specified manually
    const permissions = attributes.permissions || 'advisor';
    // ignore additional fields in context
    const context = attributes.context ? {
      contextType: attributes.context.contextType, contextId: attributes.context.contextId,
    } : null;

    const studentDir = `${dbPath}/${studentId}`;
    const counterFilePath = `${studentDir}/counter.txt`;
    fsOps.initStudentDir(studentDir, counterFilePath);

    const counter = fsOps.getCounter(counterFilePath);
    const noteId = `${studentId}-${counter}`;

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

    writeNote(noteId, newNote, true);
    fsOps.incrementCounter(counterFilePath);

    resolve(getNoteById(noteId));
  } catch (err) {
    reject(err);
  }
});

/**
 * Patch a note by noteId
 *
 * @param {string} noteId Note ID
 * @param {object} body PATCH body
 * @returns {Promise} Promise object that represents the patched note
 */
const patchNoteById = (noteId, body) => new Promise((resolve, reject) => {
  try {
    const rawNote = fetchNote(noteId);
    if (!rawNote) {
      resolve(undefined);
    }

    const { note, permissions } = body;
    rawNote.note = note || rawNote.note;
    rawNote.permissions = permissions || rawNote.permissions;

    writeNote(noteId, rawNote);
    resolve(getNoteById(noteId));
  } catch (err) {
    reject(err);
  }
});

/**
 * Delete a note by noteId
 *
 * @param {string} noteId Note ID
 * @returns {Promise} Deletion promise
 */
const deleteNoteById = noteId => new Promise((resolve, reject) => {
  try {
    const studentId = parseStudentId(noteId);
    const noteFilePath = `${dbPath}/${studentId}/${noteId}.json`;
    resolve(fsOps.deleteFile(noteFilePath));
  } catch (err) {
    reject(err);
  }
});

module.exports = {
  getNotes,
  postNote,
  getNoteById,
  patchNoteById,
  filterNotes,
  deleteNoteById,
};
