const fs = require('fs');

/**
 * @summary Validate the DB directory path and throw an error if invalid
 * @function
 * @throws Throws an error if the path is not valid
 * @param dbDirectoryPath
 */
const validateDBPath = (dbDirectoryPath) => {
  if (!fs.existsSync(dbDirectoryPath)) {
    throw new Error(`DB directory path: '${dbDirectoryPath}' is invalid`);
  }
};

/**
 * @summary Read a JSON file and return the contents as an object
 * @function
 * @param {string} filePath
 * @returns {Object}
 */
const readJSONFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return null;
};

/**
 * @summary Write an object to a JSON file with formatting
 * @function
 * @param {string} filePath
 * @param {Object} data
 * @param {Object} options
 */
const writeJSONFile = (filePath, data, options = {}) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), options);
};

/**
 * @summary Initialize a student directory with a counter starting at '1'
 * @function
 * @param {string} studentDirPath
 * @param {string} counterFilePath
 */
const initStudentDir = (studentDirPath, counterFilePath) => {
  if (!fs.existsSync(studentDirPath)) {
    fs.mkdirSync(studentDirPath);
    fs.writeFileSync(counterFilePath, '1\n', { flag: 'wx' });
  }
};

/**
 * @summary Get the value of a counter as a string
 * @function
 * @param {string} counterFilePath
 * @returns {string}
 */
const getCounter = counterFilePath => fs.readFileSync(counterFilePath).toString().replace('\n', '');

/**
 * @summary Increment the value of a counter
 * @function
 * @param counterFilePath
 */
const incrementCounter = (counterFilePath) => {
  const counter = getCounter(counterFilePath);
  const newCounter = `${(parseInt(counter, 10) + 1).toString()}\n`;
  fs.writeFileSync(counterFilePath, newCounter);
};

const deleteFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return undefined;
};

module.exports = {
  validateDBPath, readJSONFile, writeJSONFile, initStudentDir, getCounter, incrementCounter,
};
