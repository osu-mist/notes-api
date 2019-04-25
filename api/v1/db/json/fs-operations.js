const config = require('config');
const fs = require('fs');

const { dbPath } = config.get('dataSources.json');

/**
 * @summary Validate a file path and throw an error if invalid
 * @function
 * @throws Throws an error if the file path is not valid
 * @param {string} path
 */
const validateFilePath = async (path) => {
  fs.access(path, (err) => {
    if (err) {
      throw new Error(`Path: '${path}' is invalid: ${err}`);
    }
  });
};

/**
 * @summary Validate database file path
 * @function
 */
const validateJsonDb = () => validateFilePath(dbPath);

/**
 * @summary Read a JSON file and return the contents as an object
 * @function
 * @param {string} filePath
 * @returns {Object} Contents of JSON file or undefined if the file doesn't exist
 */
const readJsonFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return undefined;
};

/**
 * @summary Write an object to a JSON file with formatting
 * @function
 * @param {string} filePath
 * @param {Object} data
 * @param {Object} options
 */
const writeJsonFile = (filePath, data, options = {}) => {
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
 * @throws Throws an error if the counter file is invalid
 * @param {string} counterFilePath
 * @returns {string}
 */
const getCounter = (counterFilePath) => {
  // contents of counter file should be only digits followed by a newline
  const counterRegExp = /^(\d+)\n$/;
  const contents = fs.readFileSync(counterFilePath).toString();
  const match = counterRegExp.exec(contents);
  if (!match) {
    throw new Error(`Counter file: ${counterFilePath} contents: ${contents} are invalid`);
  } else {
    return match[1];
  }
};

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

/**
 * @summary Delete a file
 * @function
 * @param {string} filePath
 * @returns true if file was deleted and undefined if file was not found
 */
const deleteFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return undefined;
};

module.exports = {
  validateFilePath,
  validateJsonDb,
  readJsonFile,
  writeJsonFile,
  initStudentDir,
  getCounter,
  incrementCounter,
  deleteFile,
};
