const appRoot = require('app-root-path');
const _ = require('lodash');
const fs = require('fs');

const { serializeNotes } = require('../../serializers/notes-serializer');

/**
 * @summary Return a list of notes
 * @function
 * @param {Object} query Query parameters
 * @returns {Promise} Promise object represents a list of notes
 */
const getNotes = query => new Promise((resolve, reject) => {
  try {
    const {
      studentID, contextTypes,
    } = query;
    const dirPath = `/db/${studentID}`;

    let files;
    let rawNotes = [];
    try {
      files = fs.readdirSync(`${appRoot}${dirPath}`);
    } catch (ignore) {
      // rawNotes should remain an empty array
    }

    _.forEach(files, (file) => {
      rawNotes.push(appRoot.require(`${dirPath}/${file}`));
    });

    if (contextTypes) {
      const contexts = contextTypes.toString().split(',');
      console.log(`contexts: ${contexts}`);
      rawNotes = _.filter(rawNotes, it => _.includes(contexts, it.context.contextType));
    }

    rawNotes = _.sortBy(rawNotes, it => parseInt(it.id.split('-')[1], 10));

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
