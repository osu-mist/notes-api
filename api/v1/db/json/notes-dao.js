const appRoot = require('app-root-path');
const config = require('config');
const fs = require('fs');
const _ = require('lodash');
const moment = require('moment');
const path = require('path');

const { serializeNotes, serializeNote } = require('../../serializers/notes-serializer');

const fsOps = appRoot.require('utils/fs-operations');

const { dbDirectoryPath } = config.get('api');
fsOps.validateDBPath(dbDirectoryPath);

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
    creatorID, q, sources, sortKey, contextTypes,
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
const getNotes = query => new Promise((resolve, reject) => {
  try {
    const { studentID } = query;
    const studentDirPath = `${dbDirectoryPath}/${studentID}`;
    let noteFiles = fs.existsSync(studentDirPath) ? fs.readdirSync(studentDirPath) : [];
    noteFiles = _.filter(noteFiles, it => path.extname(it).toLowerCase() === '.json');

    let rawNotes = [];
    _.forEach(noteFiles, (file) => {
      const rawNote = fsOps.readJSONFile(`${studentDirPath}/${file}`);
      rawNotes.source = localSourceName;
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
 * @summary Fetch a note from the database by its noteID
 * @function
 * @param noteID
 * @returns {Object} The raw note from the DB
 */
const fetchNote = (noteID) => {
  try {
    const studentID = parseStudentID(noteID);
    const studentDirPath = `${dbDirectoryPath}/${studentID}`;
    return fsOps.readJSONFile(`${studentDirPath}/${noteID}.json`);
  } catch (err) {
    return null;
  }
};

/**
 * @summary Write newContents to the note with id noteID
 * @function
 * @param noteID
 * @param newContents
 * @param failIfExists If true, the method will throw an error if the file
 *                     already exists
 */
const writeNote = (noteID, newContents, failIfExists = false) => {
  const options = failIfExists ? { flag: 'wx' } : { flag: 'w' };
  const studentID = parseStudentID(noteID);
  const noteFilePath = `${dbDirectoryPath}/${studentID}/${noteID}.json`;
  fsOps.writeJSONFile(noteFilePath, newContents, options);
};

/**
 * @summary Return a specific note by noteID
 * @function
 * @param {string} noteID id of the note in the form: '{studentID}-{number}'
 * @returns {Promise} Promise object represents a specific note
 */
const getNoteByID = noteID => new Promise((resolve, reject) => {
  try {
    const rawNote = fetchNote(noteID);
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
 * @summary Create a new note
 * @function
 * @param body
 * @returns {Promise} Promise object representing the new note
 */
const postNote = body => new Promise((resolve, reject) => {
  try {
    const { attributes } = body.data;
    const {
      note, studentID, creatorID,
    } = attributes;

    // express-openapi does not correctly handle this default value so it must be specified manually
    const permissions = attributes.permissions || 'advisor';
    // ignore additional fields in context
    const context = attributes.context ? {
      contextType: attributes.context.contextType, contextID: attributes.context.contextID,
    } : null;

    const studentDir = `${dbDirectoryPath}/${studentID}`;
    const counterFilePath = `${studentDir}/counter.txt`;
    fsOps.initStudentDir(studentDir, counterFilePath);

    const counter = fsOps.getCounter(counterFilePath);
    const noteID = `${studentID}-${counter}`;

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

    writeNote(noteID, newNote, true);
    fsOps.incrementCounter(counterFilePath);

    resolve(getNoteByID(noteID));
  } catch (err) {
    reject(err);
  }
});

/**
 * @summary Patch a note by noteID
 * @function
 * @param noteID
 * @param body
 * @returns {Promise} Promise object that represents the patched note
 */
const patchNoteByID = (noteID, body) => new Promise((resolve, reject) => {
  try {
    const rawNote = fetchNote(noteID);
    if (!rawNote) {
      resolve(undefined);
    }

    const { note, permissions } = body;
    rawNote.note = note || rawNote.note;
    rawNote.permissions = permissions || rawNote.permissions;

    writeNote(noteID, rawNote);
    resolve(getNoteByID(noteID));
  } catch (err) {
    reject(err);
  }
});

const deleteNoteByID = noteID => new Promise((resolve, reject) => {
  try {
    const studentID = parseStudentID(noteID);
    const noteFilePath = `${dbDirectoryPath}/${studentID}/${noteID}.json`;
    resolve(fsOps.deleteFile(noteFilePath));
  } catch (err) {
    reject(err);
  }
});

module.exports = {
  getNotes,
  postNote,
  getNoteByID,
  patchNoteByID,
  filterNotes,
  deleteNoteByID,
};
