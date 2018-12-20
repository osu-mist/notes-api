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
  // This is the value of the 'source' field that will be set for all notes fetched from the DB.
  const sourceValue = 'advisorPortal';

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
    _.forEach(rawNotes, (it) => { it.source = sourceValue; });
    rawNotes = filterNotes(rawNotes, query);

    const serializedNotes = serializeNotes(rawNotes, query);
    resolve(serializedNotes);
  } catch (err) {
    reject(err);
  }
});

// /**
//  * @summary Return a specific pet by unique ID
//  * @function
//  * @param {string} id Unique pet ID
//  * @returns {Promise} Promise object represents a specific pet
//  */
// const getPetById = id => new Promise((resolve, reject) => {
//   try {
//     const rawPets = appRoot.require('/tests/unit/mock-data.json').pets;
//     const rawPet = _.find(rawPets, { ID: id });
//     if (!rawPet) {
//       resolve(undefined);
//     } else {
//       const serializedPet = SerializedPet(rawPet);
//       resolve(serializedPet);
//     }
//   } catch (err) {
//     reject(err);
//   }
// });

const postNotes = body => new Promise((resolve, reject) => {
  try {
    const {
      note, studentID, creatorID,
    } = body;

    // express-openapi does not correctly handle this default value so it must be specified manually
    const permissions = body.permissions || 'advisor';
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
      source: 'advisorPortal',
    };
    newNote.dateCreated = new Date().toISOString();
    newNote.lastModified = newNote.dateCreated;

    const serializedNote = serializeNote(newNote);

    const studentDir = `${dbDirectoryPath}/${studentID}`;
    if (!fs.existsSync(studentDir)) {
      fs.mkdir(studentDir);
    }
    const noteFilePath = `${studentDir}/${noteID}.json`;

    fs.writeFileSync(noteFilePath, JSON.stringify(newNote, null, 2), { flag: 'wx' });

    const newCounter = `${(parseInt(counter, 10) + 1).toString()}\n`;
    fs.writeFileSync(`${dbDirectoryPath}/${dbCounterFileName}`, newCounter);

    resolve(serializedNote);
  } catch (err) {
    reject(err);
  }
});

module.exports = { getNotes, postNotes };
