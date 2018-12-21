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

module.exports = { readJSONFile, writeJSONFile };
