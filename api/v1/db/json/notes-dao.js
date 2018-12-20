const _ = require('lodash');
const fs = require('fs');
const config = require('config');

const { serializeNotes, serializeNote } = require('../../serializers/notes-serializer');

const { dbDirectoryPath, dbCounterFileName } = config.api;
if (!fs.existsSync(dbDirectoryPath)) {
  throw new Error(`DB directory path: '${dbDirectoryPath}' is invalid`);
} else if (!fs.existsSync(`${dbDirectoryPath}/${dbCounterFileName}`)) {
  throw new Error(`dbCounterFileName: ${dbCounterFileName} is invalid`);
}
// This is the value of the 'source' field that will be set for all notes fetched from the local DB.
const localSourceName = 'advisorPortal';

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
    q, sources, sortKey, contextTypes,
  } = queryParams;

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
    let noteFiles;
    let rawNotes = [];
    try {
      noteFiles = fs.readdirSync(studentDirPath);
    } catch (ignore) {
      // rawNotes should remain an empty array if directory does not exist
    }

    _.forEach(noteFiles, (file) => {
      rawNotes.push(JSON.parse(fs.readFileSync(`${studentDirPath}/${file}`, 'utf8')));
    });
    _.forEach(rawNotes, (it) => { it.source = localSourceName; });
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

    let rawNote;
    try {
      rawNote = JSON.parse(fs.readFileSync(`${studentDirPath}/${noteID}.json`, 'utf8'));
    } catch (err) {
      resolve(null);
    }
    rawNote.source = localSourceName;

    const serializedNote = serializeNote(rawNote);
    resolve(serializedNote);
  } catch (err) {
    reject(err);
  }
});

const postNotes = body => new Promise((resolve, reject) => {
  try {
    const {
      note, studentID, creatorID,
    } = body;

    // express-openapi does not correctly handle this default value so it must be specified manually
    const permissions = body.permissions || 'advisor';
    // ignore additional fields in context
    const context = body.context ? {
      contextType: body.context.contextType, contextID: body.context.contextID,
    } : null;

    const counter = fs.readFileSync(`${dbDirectoryPath}/${dbCounterFileName}`)
      .toString().replace('\n', '');
    const noteID = `${studentID}-${counter}`;

    const newNote = {
      id: noteID,
      note,
      studentID,
      creatorID,
      permissions,
      context,
    };
    newNote.dateCreated = new Date().toISOString();
    newNote.lastModified = newNote.dateCreated;

    const studentDir = `${dbDirectoryPath}/${studentID}`;
    if (!fs.existsSync(studentDir)) {
      fs.mkdirSync(studentDir);
    }
    const noteFilePath = `${studentDir}/${noteID}.json`;

    fs.writeFileSync(noteFilePath, JSON.stringify(newNote, null, 2), { flag: 'wx' });
    const newCounter = `${(parseInt(counter, 10) + 1).toString()}\n`;
    fs.writeFileSync(`${dbDirectoryPath}/${dbCounterFileName}`, newCounter);

    const serializedNote = getNoteByID(noteID);
    resolve(serializedNote);
  } catch (err) {
    reject(err);
  }
});

module.exports = { getNotes, postNotes };
