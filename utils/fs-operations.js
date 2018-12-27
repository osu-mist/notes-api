const fs = require('fs');

const readJSONFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return null;
};

const writeJSONFile = (filePath, data, options = {}) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), options);
};

const deleteFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
};

module.exports = { readJSONFile, writeJSONFile, deleteFile };
