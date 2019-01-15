const appRoot = require('app-root-path');
const config = require('config');
const fs = require('fs');
const _ = require('lodash');
const moment = require('moment');
const path = require('path');

const { serializeNotes, serializeNote } = require('../../serializers/notes-serializer');

const {
  validateDBPath, readJSONFile, writeJSONFile, initStudentDir, getCounter, incrementCounter,
} = appRoot.require('utils/fs-operations');

// This is the value of the 'source' field that will be set for all notes fetched from the local DB.
const localSourceName = 'advisorPortal';

const { dbDirectoryPath } = config.get('api');
validateDBPath(dbDirectoryPath);

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
      const rawNote = readJSONFile(`${studentDirPath}/${file}`);
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
 * @summary Return a specific note by noteID
 * @function
 * @param {string} noteID id of the note in the form: '{studentID}-{number}'
 * @returns {Promise} Promise object represents a specific note
 */
const getNoteByID = noteID => new Promise((resolve, reject) => {
  try {
    const studentID = noteID.split('-')[0];
    const studentDirPath = `${dbDirectoryPath}/${studentID}`;

    const rawNote = readJSONFile(`${studentDirPath}/${noteID}.json`);
    if (!rawNote) {
      resolve(null);
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
const postNotes = body => new Promise((resolve, reject) => {
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
    initStudentDir(studentDir, counterFilePath);

    const counter = getCounter(counterFilePath);
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

    const noteFilePath = `${studentDir}/${noteID}.json`;
    writeJSONFile(noteFilePath, newNote, { flag: 'wx' });
    incrementCounter(counterFilePath);

    const serializedNote = getNoteByID(noteID);
    resolve(serializedNote);
  } catch (err) {
    reject(err);
  }
});

module.exports = { getNotes, postNotes };
