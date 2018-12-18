const _ = require('lodash');
const fs = require('fs');
const config = require('config');

const { serializeNotes } = require('../../serializers/notes-serializer');

/**
 * @summary Filter notes using parameters
 * @function
 * @param {Object[]} rawNotes The list of notes to be filtered
 * @param {Object} queryParams Key-value pairs of query parameters and their values
 * @returns {Object[]} List of filtered notes
 */
const filterNotes = (rawNotes, queryParams) => {
  const {
    q, sources, sortKey, contextTypes,
  } = queryParams;

  rawNotes = contextTypes
    ? _.filter(rawNotes, it => _.includes(contextTypes, it.context.contextType))
    : rawNotes;
  rawNotes = q ? _.filter(rawNotes, it => _.includes(it.note, q)) : rawNotes;
  // sort first by sortKey, and then by lastModified within each sorted group
  rawNotes = _.orderBy(
    rawNotes,
    [
      sortKey === 'contextType' ? it => it.context[sortKey] : it => it[sortKey],
      it => it.lastModified,
    ],
    [sortKey === 'lastModified' ? 'desc' : 'asc', 'desc'],
  );
  _.forEach(rawNotes, (it) => {
    it.source = 'advisorPortal';
  });
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
    const { dbDirectoryPath } = config.api;
    if (!fs.existsSync(dbDirectoryPath)) {
      reject(new Error(`DB directory path: '${dbDirectoryPath}' is invalid`));
    }

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
    rawNotes = filterNotes(rawNotes, query);

    const serializedNotes = serializeNotes(rawNotes, query);
    resolve(serializedNotes);
  } catch (err) {
    reject(err);
  }
});

/**
 * @summary Return a specific pet by unique ID
 * @function
 * @param {string} id Unique pet ID
 * @returns {Promise} Promise object represents a specific pet
 */
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

module.exports = { getNotes };
